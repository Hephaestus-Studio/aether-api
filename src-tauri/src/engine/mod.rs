//! Core engine module containing key business logic component subsystems.
//!
//! This module includes:
//! - [`fractional_index`]: Utilities for computing fractional indexing keys.
//! - [`fs_scanner`]: Scanner for generating workspace file trees.
//! - [`http_client`]: Execute HTTP requests and tracking active tasks.
//! - [`variable_resolver`]: Substitution of environment variable placeholders.
//! - [`yaml_parser`]: Utility functions to safely parse and serialize YAML data.

pub mod config;
pub mod crypto;
pub mod fractional_index;
pub mod fs_scanner;
pub mod git_engine;
pub mod http_client;
pub mod key_manager;
pub mod sse_client;
pub mod variable_resolver;
pub mod websocket_client;
pub mod yaml_parser;
