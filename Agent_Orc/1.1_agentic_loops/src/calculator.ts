// calculator.ts — the arithmetic behind the calculator tool.
//
// Claude sends the expression as text. Running it through eval() would execute
// whatever Claude wrote, so this is a tiny parser that accepts only numbers,
// + - * / and parentheses. Anything else throws, and the tool reports an error.
//
// Grammar (each level binds tighter than the one above):
//   expr   = term (("+"|"-") term)*
//   term   = factor (("*"|"/") factor)*
//   factor = number | "(" expr ")" | "-" factor

export function evaluate(expression: string): number {
  // Split into numbers, operators and parentheses. The last alternative, \S, turns any
  // other character into a token of its own, so the parser can reject it by name.
  const tokens = expression.match(/\d+(?:\.\d+)?|\.\d+|[+\-*/()]|\S/g) ?? [];
  let pos = 0;

  const peek = () => tokens[pos]; // look at the next token
  const next = () => tokens[pos++]; // take the next token

  function expr(): number {
    let value = term();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const right = term();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  function term(): number {
    let value = factor();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const right = factor();
      value = op === "*" ? value * right : value / right;
    }
    return value;
  }

  function factor(): number {
    const token = next();
    if (token === "-") return -factor(); // unary minus, e.g. "-(2+3)"
    if (token === "(") {
      const value = expr();
      if (next() !== ")") throw new Error("missing closing parenthesis");
      return value;
    }
    // Stray \S tokens reach here too, so a token must still be checked to be a number.
    if (token !== undefined && /^(\d+(\.\d+)?|\.\d+)$/.test(token)) return Number(token);
    throw new Error(`unexpected ${token === undefined ? "end of expression" : `"${token}"`}`);
  }

  const result = expr();
  if (pos < tokens.length) throw new Error(`unexpected "${tokens[pos]}"`);
  if (!Number.isFinite(result)) throw new Error("result is not a finite number (division by zero?)");
  return result;
}
