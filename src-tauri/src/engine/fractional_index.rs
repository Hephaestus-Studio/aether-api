const ALPHABET: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const COMPACTION_THRESHOLD: usize = 32;

/// Utility for performing fractional index ordering calculations.
///
/// Fractional indexing allows real-time reordering of list nodes in the UI sidebar
/// without the need to rewrite the order of all adjacent elements.
pub struct FractionalIndexer;

impl FractionalIndexer {
    /// Generates a new fractional index key string lexicographically positioned between `prev` and `next`.
    ///
    /// If `prev` is `None`, defaults to starting key `"a0"`.
    /// If `next` is `None`, defaults to ending key `"z9"`.
    pub fn generate_between(prev: Option<&str>, next: Option<&str>) -> String {
        let p = prev.unwrap_or("a0");
        let n = next.unwrap_or("z9");

        let p_bytes = p.as_bytes();
        let n_bytes = n.as_bytes();

        let mut result = Vec::new();
        let max_len = p_bytes.len().max(n_bytes.len()) + 1;

        for i in 0..max_len {
            let p_char = *p_bytes.get(i).unwrap_or(&b'0');
            let n_char = *n_bytes.get(i).unwrap_or(&b'z');

            if n_char > p_char + 1 {
                let mid = p_char + (n_char - p_char) / 2;
                result.push(mid);
                break;
            } else if n_char > p_char {
                result.push(p_char);
            } else {
                result.push(p_char);
            }
        }

        if result.len() >= max_len {
            let mid = b'0' + (b'z' - b'0') / 2;
            result.push(mid);
        }

        String::from_utf8(result).unwrap_or_else(|_| "a0V".to_string())
    }

    /// Generates a key lexicographically before the first existing key.
    pub fn generate_first(existing_first: Option<&str>) -> String {
        Self::generate_between(None, existing_first)
    }

    /// Generates a key lexicographically after the last existing key.
    pub fn generate_last(existing_last: Option<&str>) -> String {
        Self::generate_between(existing_last, None)
    }

    /// Determines whether the given key has exceeded the length threshold
    /// and needs compaction to prevent performance degradation.
    pub fn needs_compaction(key: &str) -> bool {
        key.len() > COMPACTION_THRESHOLD
    }

    /// Generates a list of sorted, sequential fractional index keys.
    ///
    /// Uses a fixed-width base-62 encoding scheme to guarantee that
    /// the generated keys are strictly increasing for any count.
    pub fn compact(count: usize) -> Vec<String> {
        let mut result = Vec::with_capacity(count);
        if count == 0 {
            return result;
        }

        // Determine the number of digits needed for base-62 representation
        let mut width = 1;
        let mut max_val = count - 1;
        while max_val >= ALPHABET.len() {
            max_val /= ALPHABET.len();
            width += 1;
        }

        for i in 0..count {
            let mut val = i;
            let mut key_chars = vec![b'0'; width];
            for pos in (0..width).rev() {
                let char_idx = val % ALPHABET.len();
                key_chars[pos] = ALPHABET[char_idx];
                val /= ALPHABET.len();
            }
            // Prepend 'a' to keep it aligned with fractional indexing defaults
            let key = format!("a{}", String::from_utf8(key_chars).unwrap());
            result.push(key);
        }

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_between_simple() {
        let key = FractionalIndexer::generate_between(Some("a0"), Some("a2"));
        assert_eq!(key, "a1");
    }

    #[test]
    fn test_generate_between_wide_gap() {
        let key = FractionalIndexer::generate_between(Some("a0"), Some("z9"));
        assert!(key.as_str() > "a0");
        assert!(key.as_str() < "z9");
    }

    #[test]
    fn test_generate_between_narrow_gap() {
        let key = FractionalIndexer::generate_between(Some("a0"), Some("a1"));
        assert!(key.as_str() > "a0");
        assert!(key.as_str() < "a1");
        assert!(key.len() > 2, "Narrow gap should produce longer key");
    }

    #[test]
    fn test_generate_between_none_defaults() {
        let key = FractionalIndexer::generate_between(None, None);
        assert!(key.as_str() > "a0");
        assert!(key.as_str() < "z9");
    }

    #[test]
    fn test_generate_first_before_existing() {
        let key = FractionalIndexer::generate_first(Some("a5"));
        assert!(key.as_str() < "a5");
    }

    #[test]
    fn test_generate_last_after_existing() {
        let key = FractionalIndexer::generate_last(Some("a5"));
        assert!(key.as_str() > "a5");
    }

    #[test]
    fn test_ordering_preservation() {
        let k1 = FractionalIndexer::generate_between(Some("a0"), Some("z9"));
        let k2 = FractionalIndexer::generate_between(Some(&k1), Some("z9"));
        let k3 = FractionalIndexer::generate_between(Some("a0"), Some(&k1));

        assert!(k3 < k1, "k3 should be before k1");
        assert!(k1 < k2, "k1 should be before k2");
    }

    #[test]
    fn test_needs_compaction() {
        assert!(!FractionalIndexer::needs_compaction("a0"));
        assert!(!FractionalIndexer::needs_compaction("a0VVV"));

        let long_key = "a".repeat(33);
        assert!(FractionalIndexer::needs_compaction(&long_key));
    }

    #[test]
    fn test_compact_generates_ordered_keys() {
        let keys = FractionalIndexer::compact(5);
        assert_eq!(keys.len(), 5);

        for i in 1..keys.len() {
            assert!(
                keys[i] > keys[i - 1],
                "Keys must be ordered: {} > {}",
                keys[i],
                keys[i - 1]
            );
        }
    }

    #[test]
    fn test_compact_large_count() {
        let keys = FractionalIndexer::compact(100);
        assert_eq!(keys.len(), 100);

        for i in 1..keys.len() {
            assert!(keys[i] > keys[i - 1]);
        }
    }
}
