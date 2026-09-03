use crate::errors::AppError;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Stdio;
use tokio::process::Command;

/// Information about a single file in Git repository status.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GitFileInfo {
    /// Relative path to the file from workspace root.
    pub path: String,
    /// Status description: "modified", "added", "deleted", "untracked", "conflicted", "renamed".
    pub status: String,
    /// 2-character staging code from git (e.g. "M.", ".M", "UU", "??").
    pub code: String,
}

/// Comprehensive Git status payload.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusInfo {
    /// Active branch name (e.g. "main", "feature/auth").
    pub branch_name: String,
    /// Upstream tracking branch name (e.g. "origin/main"), if configured.
    pub upstream_branch: Option<String>,
    /// Number of commits ahead of upstream.
    pub ahead_count: u32,
    /// Number of commits behind upstream.
    pub behind_count: u32,
    /// Files currently staged for commit.
    pub staged_files: Vec<GitFileInfo>,
    /// Modified/deleted files not yet staged.
    pub unstaged_files: Vec<GitFileInfo>,
    /// Untracked new files.
    pub untracked_files: Vec<GitFileInfo>,
    /// Files with unresolved merge/rebase conflicts.
    pub conflicted_files: Vec<GitFileInfo>,
    /// True if there are no changes and no conflicts.
    pub is_clean: bool,
    /// True if a merge or rebase is actively in progress.
    pub is_merging: bool,
    /// True if a rebase is actively in progress.
    pub is_rebasing: bool,
}

/// Git branch descriptor.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchInfo {
    /// Name of the branch.
    pub name: String,
    /// True if this is the currently checked out branch.
    pub is_current: bool,
    /// True if this is a remote-tracking branch.
    pub is_remote: bool,
}

/// Detailed 3-way conflict data for a specific file.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFileInfo {
    /// Relative path to the conflicted file.
    pub path: String,
    /// Full content of the file containing raw conflict markers.
    pub raw_content: String,
    /// The local version ("Ours" / HEAD).
    pub ours_content: String,
    /// The incoming version ("Theirs" / Incoming).
    pub theirs_content: String,
    /// The common ancestor version ("Base"), if available.
    pub base_content: Option<String>,
    /// True if the file was parsed successfully as standard YAML/Request model.
    pub is_request_yaml: bool,
}

/// Helper function to execute a git command in a working directory.
pub async fn run_git(cwd: &Path, args: &[&str]) -> Result<String, AppError> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                AppError::GitNotFound
            } else {
                AppError::Io(e)
            }
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let error_msg = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("Git command 'git {}' failed with status {}", args.join(" "), output.status)
        };

        if error_msg.contains("not a git repository") {
            return Err(AppError::NotAGitRepository);
        }
        if error_msg.contains("CONFLICT") || error_msg.contains("conflict") {
            return Err(AppError::GitConflict(error_msg));
        }
        return Err(AppError::GitError(error_msg));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Parses the output of `git status --porcelain=v2 --branch`.
pub fn parse_porcelain_v2(output: &str, is_merging: bool, is_rebasing: bool) -> GitStatusInfo {
    let mut branch_name = "HEAD".to_string();
    let mut upstream_branch = None;
    let mut ahead_count = 0;
    let mut behind_count = 0;

    let mut staged_files = Vec::new();
    let mut unstaged_files = Vec::new();
    let mut untracked_files = Vec::new();
    let mut conflicted_files = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Branch header line: # branch.head <name>
        if let Some(rest) = line.strip_prefix("# branch.head ") {
            branch_name = rest.trim().to_string();
            continue;
        }

        // Branch upstream line: # branch.upstream <upstream>
        if let Some(rest) = line.strip_prefix("# branch.upstream ") {
            upstream_branch = Some(rest.trim().to_string());
            continue;
        }

        // Branch ahead/behind: # branch.ab +<ahead> -<behind>
        if let Some(rest) = line.strip_prefix("# branch.ab ") {
            let parts: Vec<&str> = rest.split_whitespace().collect();
            for p in parts {
                if let Some(a) = p.strip_prefix('+') {
                    ahead_count = a.parse::<u32>().unwrap_or(0);
                } else if let Some(b) = p.strip_prefix('-') {
                    behind_count = b.parse::<u32>().unwrap_or(0);
                }
            }
            continue;
        }

        if line.starts_with('#') {
            continue;
        }

        // Untracked entry: ? <path>
        if let Some(rest) = line.strip_prefix("? ") {
            let path = rest.trim().to_string();
            untracked_files.push(GitFileInfo {
                path,
                status: "untracked".to_string(),
                code: "??".to_string(),
            });
            continue;
        }

        // Ignored entry: ! <path>
        if line.starts_with("! ") {
            continue;
        }

        // Unmerged/conflicted entry: u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
        if let Some(rest) = line.strip_prefix("u ") {
            let parts: Vec<&str> = rest.split_whitespace().collect();
            if parts.len() >= 10 {
                let code = parts[0].to_string();
                let path = parts[9..].join(" ");
                conflicted_files.push(GitFileInfo {
                    path,
                    status: "conflicted".to_string(),
                    code,
                });
            }
            continue;
        }

        // Ordinary changed entry: 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
        if let Some(rest) = line.strip_prefix("1 ") {
            let parts: Vec<&str> = rest.split_whitespace().collect();
            if parts.len() >= 8 {
                let xy = parts[0];
                let path = parts[7..].join(" ");
                let staged_char = xy.chars().next().unwrap_or('.');
                let unstaged_char = xy.chars().nth(1).unwrap_or('.');

                if staged_char != '.' {
                    let status = match staged_char {
                        'M' => "modified",
                        'A' => "added",
                        'D' => "deleted",
                        'R' => "renamed",
                        'C' => "copied",
                        _ => "modified",
                    };
                    staged_files.push(GitFileInfo {
                        path: path.clone(),
                        status: status.to_string(),
                        code: format!("{}.", staged_char),
                    });
                }

                if unstaged_char != '.' {
                    let status = match unstaged_char {
                        'M' => "modified",
                        'A' => "added",
                        'D' => "deleted",
                        _ => "modified",
                    };
                    unstaged_files.push(GitFileInfo {
                        path,
                        status: status.to_string(),
                        code: format!(".{}", unstaged_char),
                    });
                }
            }
            continue;
        }

        // Renamed/copied entry: 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path><sep><origPath>
        if let Some(rest) = line.strip_prefix("2 ") {
            let parts: Vec<&str> = rest.split_whitespace().collect();
            if parts.len() >= 9 {
                let xy = parts[0];
                let path = parts[8..].join(" ");
                let staged_char = xy.chars().next().unwrap_or('.');
                let unstaged_char = xy.chars().nth(1).unwrap_or('.');

                if staged_char != '.' {
                    staged_files.push(GitFileInfo {
                        path: path.clone(),
                        status: "renamed".to_string(),
                        code: format!("{}.", staged_char),
                    });
                }

                if unstaged_char != '.' {
                    unstaged_files.push(GitFileInfo {
                        path,
                        status: "renamed".to_string(),
                        code: format!(".{}", unstaged_char),
                    });
                }
            }
        }
    }

    let is_clean = staged_files.is_empty()
        && unstaged_files.is_empty()
        && untracked_files.is_empty()
        && conflicted_files.is_empty();

    GitStatusInfo {
        branch_name,
        upstream_branch,
        ahead_count,
        behind_count,
        staged_files,
        unstaged_files,
        untracked_files,
        conflicted_files,
        is_clean,
        is_merging,
        is_rebasing,
    }
}

/// Checks if repository is currently in a merge or rebase state.
pub fn check_git_state(git_dir: &Path) -> (bool, bool) {
    let is_merging = git_dir.join("MERGE_HEAD").exists();
    let is_rebasing = git_dir.join("rebase-apply").exists()
        || git_dir.join("rebase-merge").exists();
    (is_merging, is_rebasing)
}

/// Retrieves complete repository Git status.
pub async fn get_status(cwd: &Path) -> Result<GitStatusInfo, AppError> {
    let raw_status = run_git(cwd, &["status", "--porcelain=v2", "--branch", "-uall"]).await?;
    let git_dir = cwd.join(".git");
    let (is_merging, is_rebasing) = check_git_state(&git_dir);

    Ok(parse_porcelain_v2(&raw_status, is_merging, is_rebasing))
}

/// Stages specific files or all files.
pub async fn stage_paths(cwd: &Path, paths: &[String]) -> Result<(), AppError> {
    if paths.is_empty() {
        run_git(cwd, &["add", "-A"]).await?;
    } else {
        let mut args = vec!["add", "--"];
        for p in paths {
            args.push(p.as_str());
        }
        run_git(cwd, &args).await?;
    }
    Ok(())
}

/// Unstages specific files or all files.
pub async fn unstage_paths(cwd: &Path, paths: &[String]) -> Result<(), AppError> {
    if paths.is_empty() {
        run_git(cwd, &["restore", "--staged", "."]).await?;
    } else {
        let mut args = vec!["restore", "--staged", "--"];
        for p in paths {
            args.push(p.as_str());
        }
        run_git(cwd, &args).await?;
    }
    Ok(())
}

/// Discards uncommitted changes for specified files.
pub async fn discard_changes(cwd: &Path, paths: &[String]) -> Result<(), AppError> {
    if paths.is_empty() {
        run_git(cwd, &["restore", "."]).await?;
        run_git(cwd, &["clean", "-fd"]).await?;
    } else {
        let mut restore_args = vec!["restore", "--"];
        let mut clean_args = vec!["clean", "-fd", "--"];
        for p in paths {
            restore_args.push(p.as_str());
            clean_args.push(p.as_str());
        }
        let _ = run_git(cwd, &restore_args).await;
        let _ = run_git(cwd, &clean_args).await;
    }
    Ok(())
}

/// Commits staged changes with a message.
pub async fn commit(cwd: &Path, message: &str) -> Result<String, AppError> {
    if message.trim().is_empty() {
        return Err(AppError::GitError("Commit message cannot be empty".to_string()));
    }
    run_git(cwd, &["commit", "-m", message]).await
}

/// Fetches from remote.
pub async fn fetch(cwd: &Path) -> Result<String, AppError> {
    run_git(cwd, &["fetch", "--prune"]).await
}

/// Performs safe smart sync:
/// 1. Stash changes if any uncommitted
/// 2. Pull --rebase
/// 3. Pop stash if stashed
/// 4. Push to remote
pub async fn smart_sync(cwd: &Path) -> Result<String, AppError> {
    let status = get_status(cwd).await?;
    let has_local_changes = !status.is_clean;
    let mut stashed = false;

    if has_local_changes {
        let stash_res = run_git(cwd, &["stash", "push", "-u", "-m", "aether-auto-sync-stash"]).await?;
        if !stash_res.contains("No local changes to save") {
            stashed = true;
        }
    }

    // Pull with rebase
    let pull_res = match run_git(cwd, &["pull", "--rebase"]).await {
        Ok(res) => res,
        Err(e) => {
            if stashed {
                let _ = run_git(cwd, &["stash", "pop"]).await;
            }
            return Err(e);
        }
    };

    // Restore stash if stashed
    if stashed {
        let pop_res = run_git(cwd, &["stash", "pop"]).await;
        if let Err(e) = pop_res {
            tracing::warn!("Stash pop encountered conflict: {:?}", e);
        }
    }

    // Push if ahead
    let current_status = get_status(cwd).await?;
    if current_status.ahead_count > 0 {
        run_git(cwd, &["push"]).await?;
    }

    Ok(pull_res)
}

/// Pushes commits to remote.
pub async fn push(cwd: &Path) -> Result<String, AppError> {
    run_git(cwd, &["push"]).await
}

/// Pulls from remote with rebase.
pub async fn pull_rebase(cwd: &Path) -> Result<String, AppError> {
    run_git(cwd, &["pull", "--rebase"]).await
}

/// Lists local and remote branches.
pub async fn list_branches(cwd: &Path) -> Result<Vec<GitBranchInfo>, AppError> {
    let output = run_git(cwd, &["branch", "-a", "--no-color"]).await?;
    let mut branches = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.contains("->") {
            continue;
        }

        let is_current = line.starts_with('*');
        let raw_name = trimmed.trim_start_matches('*').trim();
        let is_remote = raw_name.starts_with("remotes/");
        let clean_name = if is_remote {
            raw_name.trim_start_matches("remotes/").to_string()
        } else {
            raw_name.to_string()
        };

        branches.push(GitBranchInfo {
            name: clean_name,
            is_current,
            is_remote,
        });
    }

    Ok(branches)
}

/// Switches branch or creates a new branch.
pub async fn checkout_branch(cwd: &Path, branch: &str, create: bool) -> Result<String, AppError> {
    if create {
        run_git(cwd, &["checkout", "-b", branch]).await
    } else {
        run_git(cwd, &["checkout", branch]).await
    }
}

/// Parses a file containing git merge conflict markers.
pub fn parse_conflict_markers(content: &str) -> (String, String, Option<String>) {
    let mut ours_lines = Vec::new();
    let mut theirs_lines = Vec::new();
    let mut base_lines = Vec::new();
    let mut has_base = false;

    #[derive(PartialEq)]
    enum State {
        Normal,
        Ours,
        Base,
        Theirs,
    }

    let mut state = State::Normal;

    for line in content.lines() {
        if line.starts_with("<<<<<<<") {
            state = State::Ours;
            continue;
        } else if line.starts_with("|||||||") {
            state = State::Base;
            has_base = true;
            continue;
        } else if line.starts_with("=======") {
            state = State::Theirs;
            continue;
        } else if line.starts_with(">>>>>>>") {
            state = State::Normal;
            continue;
        }

        match state {
            State::Normal => {
                ours_lines.push(line);
                theirs_lines.push(line);
                if has_base {
                    base_lines.push(line);
                }
            }
            State::Ours => {
                ours_lines.push(line);
            }
            State::Base => {
                base_lines.push(line);
            }
            State::Theirs => {
                theirs_lines.push(line);
            }
        }
    }

    let ours = ours_lines.join("\n");
    let theirs = theirs_lines.join("\n");
    let base = if has_base { Some(base_lines.join("\n")) } else { None };

    (ours, theirs, base)
}

/// Reads a conflicted file and parses 3-way versions.
pub async fn get_conflict_file_info(cwd: &Path, rel_path: &str) -> Result<ConflictFileInfo, AppError> {
    let full_path = cwd.join(rel_path);
    if !full_path.exists() {
        return Err(AppError::ItemNotFound(rel_path.to_string()));
    }

    let raw_content = tokio::fs::read_to_string(&full_path)
        .await
        .map_err(AppError::Io)?;

    let (ours_content, theirs_content, base_content) = parse_conflict_markers(&raw_content);
    let is_request_yaml = rel_path.ends_with(".yml") || rel_path.ends_with(".yaml");

    Ok(ConflictFileInfo {
        path: rel_path.to_string(),
        raw_content,
        ours_content,
        theirs_content,
        base_content,
        is_request_yaml,
    })
}

/// Resolves conflict by writing merged content and staging the file.
pub async fn resolve_conflict(cwd: &Path, rel_path: &str, merged_content: &str) -> Result<(), AppError> {
    let full_path = cwd.join(rel_path);
    tokio::fs::write(&full_path, merged_content)
        .await
        .map_err(AppError::Io)?;

    stage_paths(cwd, &[rel_path.to_string()]).await?;
    Ok(())
}

/// Aborts an active merge or rebase.
pub async fn abort_merge(cwd: &Path) -> Result<String, AppError> {
    let git_dir = cwd.join(".git");
    let (_, is_rebasing) = check_git_state(&git_dir);

    if is_rebasing {
        run_git(cwd, &["rebase", "--abort"]).await
    } else {
        run_git(cwd, &["merge", "--abort"]).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_porcelain_v2() {
        let sample_output = r#"
# branch.oid 1234567890abcdef
# branch.head feature/collaboration
# branch.upstream origin/feature/collaboration
# branch.ab +2 -1
1 M. N... 100644 100644 100644 1234567 1234567 collections/users/get.yml
1 .M N... 100644 100644 100644 1234567 1234567 collections/users/post.yml
u UU N... 100644 100644 100644 100644 1234567 1234567 1234567 collections/users/put.yml
? collections/new_request.yml
"#;

        let status = parse_porcelain_v2(sample_output, false, false);

        assert_eq!(status.branch_name, "feature/collaboration");
        assert_eq!(status.upstream_branch, Some("origin/feature/collaboration".to_string()));
        assert_eq!(status.ahead_count, 2);
        assert_eq!(status.behind_count, 1);
        assert_eq!(status.staged_files.len(), 1);
        assert_eq!(status.staged_files[0].path, "collections/users/get.yml");
        assert_eq!(status.unstaged_files.len(), 1);
        assert_eq!(status.unstaged_files[0].path, "collections/users/post.yml");
        assert_eq!(status.conflicted_files.len(), 1);
        assert_eq!(status.conflicted_files[0].path, "collections/users/put.yml");
        assert_eq!(status.untracked_files.len(), 1);
        assert_eq!(status.untracked_files[0].path, "collections/new_request.yml");
        assert!(!status.is_clean);
    }

    #[test]
    fn test_parse_conflict_markers() {
        let sample_conflict = r#"
name: Get Users
method: GET
<<<<<<< HEAD
url: https://api.local/v1/users
headers:
  - key: X-Version
    value: 1.0
=======
url: https://api.remote/v2/users
headers:
  - key: Authorization
    value: Bearer token
>>>>>>> incoming_branch
description: Retrieve users list
"#;

        let (ours, theirs, base) = parse_conflict_markers(sample_conflict);
        assert!(ours.contains("https://api.local/v1/users"));
        assert!(ours.contains("X-Version"));
        assert!(!ours.contains("https://api.remote/v2/users"));

        assert!(theirs.contains("https://api.remote/v2/users"));
        assert!(theirs.contains("Authorization"));
        assert!(!theirs.contains("https://api.local/v1/users"));

        assert_eq!(base, None);
    }
}
