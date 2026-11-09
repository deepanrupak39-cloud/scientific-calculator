(() => {
  const expressionDisplay = document.querySelector('#expression');
  const resultDisplay = document.querySelector('#result');
  const angleButton = document.querySelector('#angle-mode');
  let expression = '';
  let degrees = true;
  let justEvaluated = false;

  const render = (preview = true) => {
    expressionDisplay.textContent = expression.replaceAll('*', '×').replaceAll('/', '÷').replaceAll('pi', 'π');
    resultDisplay.classList.remove('error');
    if (!expression) {
      resultDisplay.textContent = '0';
      return;
    }
    if (preview) {
      try {
        const value = evaluate(expression);
        resultDisplay.textContent = format(value);
      } catch {
        resultDisplay.textContent = '…';
      }
    }
  };

  const format = (number) => {
    if (!Number.isFinite(number)) throw new Error('Math error');
    if (Math.abs(number) < 1e-12) number = 0;
    return Number(number.toPrecision(11)).toString();
  };

  function evaluate(source) {
    const tokens = source.match(/(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[a-zA-Z]+|π|[()+\-*/^%!]/g) || [];
    const compact = source.replace(/\s/g, '');
    if (tokens.join('') !== compact) throw new Error('Invalid expression');
    let position = 0;
    const peek = () => tokens[position];
    const take = () => tokens[position++];
    const isPrimaryStart = (token) => token && (token === '(' || token === 'π' || /^[a-zA-Z]+$/.test(token) || /^(?:\d|\.)/.test(token));
    const requireClose = () => { if (take() !== ')') throw new Error('Missing )'); };

    function parseExpression() {
      let value = parseProduct();
      while (peek() === '+' || peek() === '-') {
        const op = take();
        const right = parseProduct();
        value = op === '+' ? value + right : value - right;
      }
      return value;
    }
    function parseProduct() {
      let value = parseUnary();
      while (true) {
        const token = peek();
        if (token === '*' || token === '/') {
          take();
          const right = parseUnary();
          value = token === '*' ? value * right : value / right;
        } else if (isPrimaryStart(token)) {
          value *= parseUnary();
        } else break;
      }
      return value;
    }
    function parseUnary() {
      if (peek() === '+') { take(); return parseUnary(); }
      if (peek() === '-') { take(); return -parseUnary(); }
      return parsePower();
    }
    function parsePower() {
      let value = parsePostfix();
      if (peek() === '^') { take(); value = Math.pow(value, parseUnary()); }
      return value;
    }
    function parsePostfix() {
      let value = parsePrimary();
      while (peek() === '!' || peek() === '%') {
        const op = take();
        if (op === '%') value /= 100;
        else {
          if (value < 0 || !Number.isInteger(value) || value > 170) throw new Error('Invalid factorial');
          let product = 1;
          for (let n = 2; n <= value; n++) product *= n;
          value = product;
        }
      }
      return value;
    }
    function parsePrimary() {
      const token = take();
      if (token === '(') {
        const value = parseExpression();
        requireClose();
        return value;
      }
      if (token === 'π') return Math.PI;
      if (token && /^(?:\d|\.)/.test(token)) return Number(token);
      if (token === 'e') return Math.E;
      const functions = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'log', 'ln', 'abs'];
      if (functions.includes(token)) {
        if (take() !== '(') throw new Error('Function needs parentheses');
        const input = parseExpression();
        requireClose();
        const angle = degrees ? Math.PI / 180 : 1;
        switch (token) {
          case 'sin': return Math.sin(input * angle);
          case 'cos': return Math.cos(input * angle);
          case 'tan': return Math.tan(input * angle);
          case 'asin': return Math.asin(input) / angle;
          case 'acos': return Math.acos(input) / angle;
          case 'atan': return Math.atan(input) / angle;
          case 'sqrt': return Math.sqrt(input);
          case 'log': return Math.log10(input);
          case 'ln': return Math.log(input);
          case 'abs': return Math.abs(input);
        }
      }
      throw new Error('Invalid expression');
    }

    const result = parseExpression();
    if (position !== tokens.length) throw new Error('Unexpected input');
    if (!Number.isFinite(result)) throw new Error('Math error');
    return result;
  }

  function insert(value) {
    const beginsNewValue = /^(?:\d|\.|π|e|\()/.test(value) || /^[a-z]/i.test(value);
    if (justEvaluated && beginsNewValue && !['^2', '^', '!', '%'].includes(value)) expression = '';
    justEvaluated = false;
    if (value === '^2' && expression) expression += '^2';
    else expression += value;
    render();
  }

  document.querySelector('.keypad').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.insert !== undefined) insert(button.dataset.insert);
    else if (button.dataset.action === 'clear') {
      expression = '';
      justEvaluated = false;
      render();
    } else if (button.dataset.action === 'backspace') {
      expression = expression.slice(0, -1);
      justEvaluated = false;
      render();
    } else if (button.dataset.action === 'sign') {
      if (!expression) expression = '-';
      else expression = `-(${expression})`;
      justEvaluated = false;
      render();
    } else if (button.dataset.action === 'equals') calculate();
  });

  function calculate() {
    if (!expression) return;
    try {
      const value = evaluate(expression);
      expressionDisplay.textContent = `${expression.replaceAll('*', '×').replaceAll('/', '÷')} =`;
      resultDisplay.textContent = format(value);
      resultDisplay.classList.remove('error');
      expression = format(value);
      justEvaluated = true;
    } catch (error) {
      resultDisplay.textContent = error.message === 'Math error' ? 'Math error' : 'Invalid input';
      resultDisplay.classList.add('error');
    }
  }

  angleButton.addEventListener('click', () => {
    degrees = !degrees;
    angleButton.textContent = degrees ? 'DEG' : 'RAD';
    angleButton.setAttribute('aria-label', `Angle mode: ${degrees ? 'degrees' : 'radians'}`);
    if (!justEvaluated) render();
  });

  document.addEventListener('keydown', (event) => {
    if (/^[0-9.]$/.test(event.key)) insert(event.key);
    else if (['+', '-', '*', '/', '^', '(', ')', '%', '!'].includes(event.key)) insert(event.key);
    else if (event.key === 'Enter' || event.key === '=') { event.preventDefault(); calculate(); }
    else if (event.key === 'Backspace') { expression = expression.slice(0, -1); justEvaluated = false; render(); }
    else if (event.key === 'Escape') { expression = ''; justEvaluated = false; render(); }
  });
})();
