import { describe, it, expect } from 'vitest';

describe('executor test-case logic', () => {
  function hasMain(code: string, language: string): boolean {
    if (language === 'cpp') return /\bint\s+main\s*\(/.test(code);
    if (language === 'java') return /public\s+static\s+void\s+main\s*\(/.test(code);
    if (language === 'go') return /\bfunc\s+main\s*\(/.test(code);
    if (language === 'rust') return /\bfn\s+main\s*\(/.test(code);
    return true;
  }

  function extractFuncName(code: string, language: string): string | null {
    if (language === 'go') {
      const m = code.match(/func\s+(\w+)\s*\(/);
      return m ? m[1] : null;
    }
    if (language === 'rust') {
      const m = code.match(/fn\s+(\w+)\s*\(/);
      return m ? m[1] : null;
    }
    const m = code.match(
      /(?:\b(?:\w+(?:<[^>]*>)?(?:\s*[&*])?)\s+)(\w+)\s*\([^)]*\)\s*(?:\bconst\b)?\s*(?:{|:\s*$)/,
    );
    if (m) {
      const name = m[1];
      if (!/^(?:if|while|for|return|switch|catch|int|char|bool|void|long|double|float|unsigned|signed|auto|public|private|protected|class|struct|virtual|override)$/.test(name)) {
        return name;
      }
    }
    return null;
  }

  describe('hasMain', () => {
    it('detects int main() in C++', () => {
      expect(hasMain('int main() { return 0; }', 'cpp')).toBe(true);
    });

    it('detects void main() in Java', () => {
      expect(hasMain('public static void main(String[] args) {}', 'java')).toBe(true);
    });

    it('detects func main in Go', () => {
      expect(hasMain('func main() {}', 'go')).toBe(true);
    });

    it('detects fn main in Rust', () => {
      expect(hasMain('fn main() {}', 'rust')).toBe(true);
    });

    it('returns false for no main in C++', () => {
      expect(hasMain('int add(int a, int b) { return a + b; }', 'cpp')).toBe(false);
    });

    it('returns true for non-compiled languages', () => {
      expect(hasMain('print(1)', 'python')).toBe(true);
      expect(hasMain('console.log(1)', 'javascript')).toBe(true);
    });
  });

  describe('extractFuncName', () => {
    it('extracts Go function name', () => {
      expect(extractFuncName('func add(a int, b int) int {', 'go')).toBe('add');
    });

    it('extracts Rust function name', () => {
      expect(extractFuncName('fn multiply(x: i32, y: i32) -> i32 {', 'rust')).toBe('multiply');
    });

    it('extracts C++ function name', () => {
      const result = extractFuncName('int add(int a, int b) { return a + b; }', 'cpp');
      expect(result).toBe('add');
    });

    it('returns null for keyword names (if, for)', () => {
      const keywords = [
        'if (x > 0) { return 1; }',
        'for (int i = 0; i < 10; i++) { }',
        'while (true) { break; }',
      ];
      for (const code of keywords) {
        expect(extractFuncName(code, 'cpp')).toBeNull();
      }
    });
  });
});
