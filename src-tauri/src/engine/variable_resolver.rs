use crate::errors::AppError;
use crate::models::environment::Variable;
use regex::Regex;
use std::collections::HashMap;
use std::sync::LazyLock;

static VAR_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{([^}]+)\}\}").expect("Invalid regex pattern"));

const MAX_RESOLVE_DEPTH: u32 = 10;

/// Resolves variable placeholders in text templates.
///
/// Looks up variable expressions wrapped in double curly braces `{{variable_name}}`
/// within string inputs and replaces them recursively with values from the environment.
pub struct VariableResolver;

impl VariableResolver {
    /// Recursively resolves all `{{variable}}` placeholders in the given input string.
    ///
    /// # Errors
    /// Returns [`AppError::CircularVariableReference`] if the recursion depth exceeds [`MAX_RESOLVE_DEPTH`].
    pub fn resolve(
        input: &str,
        vars: &HashMap<String, &Variable>,
        depth: u32,
    ) -> Result<String, AppError> {
        if depth > MAX_RESOLVE_DEPTH {
            return Err(AppError::CircularVariableReference);
        }

        let mut new_string = input.to_string();
        let mut replaced = false;

        let captures: Vec<(String, String)> = VAR_PATTERN
            .captures_iter(input)
            .map(|cap| (cap[0].to_string(), cap[1].trim().to_string()))
            .collect();

        if captures.is_empty() {
            return Ok(new_string);
        }

        for (full_match, var_name) in &captures {
            if let Some(variable) = vars.get(var_name.as_str()) {
                if variable.enabled {
                    new_string = new_string.replace(full_match, &variable.value);
                    replaced = true;
                }
            }
        }

        if replaced {
            Self::resolve(&new_string, vars, depth + 1)
        } else {
            Ok(new_string)
        }
    }

    /// Resolves `{{variable}}` placeholders in a string starting with depth 0.
    pub fn resolve_string(
        input: &str,
        vars: &HashMap<String, &Variable>,
    ) -> Result<String, AppError> {
        Self::resolve(input, vars, 0)
    }

    /// Resolves variables in all dynamic parts of an API request: URL, query params, and headers.
    #[allow(clippy::type_complexity, dead_code)]
    pub fn resolve_all_in_request(
        url: &str,
        params: &[(String, String)],
        headers: &[(String, String)],
        vars: &HashMap<String, &Variable>,
    ) -> Result<(String, Vec<(String, String)>, Vec<(String, String)>), AppError> {
        let resolved_url = Self::resolve_string(url, vars)?;

        let resolved_params: Result<Vec<(String, String)>, AppError> = params
            .iter()
            .map(|(k, v)| {
                let rk = Self::resolve_string(k, vars)?;
                let rv = Self::resolve_string(v, vars)?;
                Ok((rk, rv))
            })
            .collect();

        let resolved_headers: Result<Vec<(String, String)>, AppError> = headers
            .iter()
            .map(|(k, v)| {
                let rk = Self::resolve_string(k, vars)?;
                let rv = Self::resolve_string(v, vars)?;
                Ok((rk, rv))
            })
            .collect();

        Ok((resolved_url, resolved_params?, resolved_headers?))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::environment::{Variable, VariableType};

    fn make_var(name: &str, value: &str, enabled: bool) -> Variable {
        Variable {
            name: name.to_string(),
            value: value.to_string(),
            var_type: VariableType::Default,
            enabled,
            description: None,
        }
    }

    fn build_vars(vars: &[Variable]) -> HashMap<String, &Variable> {
        vars.iter().map(|v| (v.name.clone(), v)).collect()
    }

    #[test]
    fn test_simple_resolve() {
        let vars = vec![make_var("host", "http://localhost", true)];
        let map = build_vars(&vars);

        let result = VariableResolver::resolve("{{host}}/api", &map, 0).unwrap();
        assert_eq!(result, "http://localhost/api");
    }

    #[test]
    fn test_nested_resolve() {
        let vars = vec![
            make_var("base", "{{host}}/api", true),
            make_var("host", "http://localhost", true),
        ];
        let map = build_vars(&vars);

        let result = VariableResolver::resolve("{{base}}/users", &map, 0).unwrap();
        assert_eq!(result, "http://localhost/api/users");
    }

    #[test]
    fn test_unresolved_variable_kept_as_is() {
        let map: HashMap<String, &Variable> = HashMap::new();

        let result = VariableResolver::resolve("{{unknown}}/api", &map, 0).unwrap();
        assert_eq!(result, "{{unknown}}/api");
    }

    #[test]
    fn test_circular_reference_detected() {
        let vars = vec![make_var("a", "{{b}}", true), make_var("b", "{{a}}", true)];
        let map = build_vars(&vars);

        let result = VariableResolver::resolve("{{a}}", &map, 0);
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            AppError::CircularVariableReference
        ));
    }

    #[test]
    fn test_disabled_variable_not_replaced() {
        let vars = vec![make_var("host", "http://localhost", false)];
        let map = build_vars(&vars);

        let result = VariableResolver::resolve("{{host}}/api", &map, 0).unwrap();
        assert_eq!(result, "{{host}}/api");
    }

    #[test]
    fn test_multiple_variables_in_one_string() {
        let vars = vec![
            make_var("scheme", "https", true),
            make_var("host", "api.example.com", true),
            make_var("port", "8080", true),
        ];
        let map = build_vars(&vars);

        let result =
            VariableResolver::resolve("{{scheme}}://{{host}}:{{port}}/api", &map, 0).unwrap();
        assert_eq!(result, "https://api.example.com:8080/api");
    }

    #[test]
    fn test_no_placeholders_returns_input_unchanged() {
        let map: HashMap<String, &Variable> = HashMap::new();

        let result = VariableResolver::resolve("plain string", &map, 0).unwrap();
        assert_eq!(result, "plain string");
    }

    #[test]
    fn test_mixed_resolved_and_unresolved() {
        let vars = vec![make_var("host", "localhost", true)];
        let map = build_vars(&vars);

        let result = VariableResolver::resolve("{{host}}:{{port}}/api", &map, 0).unwrap();
        assert_eq!(result, "localhost:{{port}}/api");
    }
}
