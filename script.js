(() => {
  const expressionDisplay = document.querySelector('#expression');
  const resultDisplay = document.querySelector('#result');
  const angleButton = document.querySelector('#angle-mode');
  const voiceButton = document.querySelector('#voice-button');
  const voiceLabel = document.querySelector('#voice-label');
  const voiceStatus = document.querySelector('#voice-status');
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
        resultDisplay.textContent = format(evaluate(expression));
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
    else if (button.dataset.action === 'clear') clearExpression();
    else if (button.dataset.action === 'backspace') {
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

  function clearExpression() {
    expression = '';
    justEvaluated = false;
    render();
  }

  function calculate({ speak = false } = {}) {
    if (!expression) return;
    try {
      const value = evaluate(expression);
      expressionDisplay.textContent = `${expression.replaceAll('*', '×').replaceAll('/', '÷')} =`;
      resultDisplay.textContent = format(value);
      resultDisplay.classList.remove('error');
      expression = format(value);
      justEvaluated = true;
      if (speak) speakText(`The answer is ${resultDisplay.textContent}`);
    } catch (error) {
      resultDisplay.textContent = error.message === 'Math error' ? 'Math error' : 'Invalid input';
      resultDisplay.classList.add('error');
      if (speak) speakText('Sorry, I could not calculate that.');
    }
  }

  angleButton.addEventListener('click', () => {
    degrees = !degrees;
    angleButton.textContent = degrees ? 'DEG' : 'RAD';
    angleButton.setAttribute('aria-label', `Angle mode: ${degrees ? 'degrees' : 'radians'}`);
    if (!justEvaluated) render();
  });

  // Turn common spoken math phrases into the same safe expression syntax used by the keypad.
  function voiceToExpression(transcript) {
    let text = transcript.toLowerCase().trim().replace(/[?!,]/g, ' ');
    const replacements = [
      [/\b(open|left) parenthesis\b/g, '('], [/\b(close|right) parenthesis\b/g, ')'],
      [/\bsquare root of\b|\bsquare root\b/g, 'sqrt('], [/\bsine of\b|\bsine\b/g, 'sin('],
      [/\bcosine of\b|\bcosine\b/g, 'cos('], [/\btangent of\b|\btangent\b/g, 'tan('],
      [/\binverse sine\b/g, 'asin('], [/\binverse cosine\b/g, 'acos('], [/\binverse tangent\b/g, 'atan('],
      [/\bnatural log of\b|\bnatural log\b/g, 'ln('], [/\blog of\b|\blog\b/g, 'log('],
      [/\bto the power of\b|\bpower of\b/g, '^'], [/\bsquared\b/g, '^2'], [/\bcubed\b/g, '^3'],
      [/\bdivided by\b|\bover\b/g, '/'], [/\btimes\b|\bmultiplied by\b/g, '*'],
      [/\bplus\b/g, '+'], [/\bminus\b/g, '-'], [/\bnegative\b/g, '-'],
      [/\bpercent\b/g, '%'], [/\bfactorial\b/g, '!'], [/\bpi\b/g, 'π'], [/\beuler'?s number\b/g, 'e'],
      [/\bpoint\b/g, '.']
    ];
    for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
    const numberWords = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10' };
    text = text.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (word) => numberWords[word]);
    // Close function parentheses for natural phrases such as “square root of nine”.
    text = text.replace(/(sqrt|sin|cos|tan|asin|acos|atan|log|ln)\s+(?=[\dπe(])/g, '$1(');
    text = text.replace(/(sqrt|sin|cos|tan|asin|acos|atan|log|ln)\(([^()+*/-]+)\)/g, '$1($2)');
    return text.replace(/\s+/g, '');
  }

  function speakText(message) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => {
      voiceButton.classList.add('listening');
      voiceButton.setAttribute('aria-pressed', 'true');
      voiceLabel.textContent = 'Listening…';
      voiceStatus.textContent = 'Listening — say a calculation or “clear”.';
    };
    recognition.onend = () => {
      voiceButton.classList.remove('listening');
      voiceButton.setAttribute('aria-pressed', 'false');
      voiceLabel.textContent = 'Use voice';
    };
    recognition.onerror = (event) => {
      const messages = {
        'not-allowed': 'Microphone access was blocked. Allow it in your browser settings.',
        'no-speech': 'No speech detected. Tap the microphone and try again.',
        'audio-capture': 'No microphone was found.'
      };
      voiceStatus.textContent = messages[event.error] || 'Voice input failed. Please try again.';
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const command = transcript.toLowerCase().trim();
      voiceStatus.textContent = `Heard: “${transcript}”`;
      if (/^(clear|clear all|reset)( please)?$/.test(command)) {
        clearExpression();
        speakText('Cleared');
        return;
      }
      if (/^(degrees|degree mode)$/.test(command)) {
        degrees = true; angleButton.textContent = 'DEG'; voiceStatus.textContent = 'Degree mode selected.'; return;
      }
      if (/^(radians|radian mode)$/.test(command)) {
        degrees = false; angleButton.textContent = 'RAD'; voiceStatus.textContent = 'Radian mode selected.'; return;
      }
      const calculateNow = /\b(calculate|equals|what is|what's)\b/.test(command);
      const spokenExpression = voiceToExpression(command.replace(/\b(calculate|equals|what is|what's|please)\b/g, ' '));
      if (!spokenExpression) {
        voiceStatus.textContent = 'I didn’t catch a calculation. Try “five plus three”.';
        return;
      }
      expression = spokenExpression;
      justEvaluated = false;
      render();
      if (calculateNow) calculate({ speak: true });
    };
    voiceButton.addEventListener('click', () => {
      try { recognition.start(); }
      catch { voiceStatus.textContent = 'Voice input is already starting. Please wait.'; }
    });
  } else {
    voiceButton.disabled = true;
    voiceLabel.textContent = 'Voice unavailable';
    voiceStatus.textContent = 'Voice input is not supported in this browser. Try Chrome or Edge.';
  }

  document.addEventListener('keydown', (event) => {
    if (/^[0-9.]$/.test(event.key)) insert(event.key);
    else if (['+', '-', '*', '/', '^', '(', ')', '%', '!'].includes(event.key)) insert(event.key);
    else if (event.key === 'Enter' || event.key === '=') { event.preventDefault(); calculate(); }
    else if (event.key === 'Backspace') { expression = expression.slice(0, -1); justEvaluated = false; render(); }
    else if (event.key === 'Escape') clearExpression();
  });
})();
