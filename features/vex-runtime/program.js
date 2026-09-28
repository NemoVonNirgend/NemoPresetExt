/** Restricted dependency preflight for the fingerprinted v12 Vex program.
 * Never evaluates arbitrary JavaScript, never touches ST variables, and never
 * supplies its prose to the model. ST still executes the original program.
 */
export function compile(text) {
    if (typeof text !== 'string' || text.length > 400000) throw new Error('Unsupported Vex program size.');
    let pos = 0, nodes = 0;
    function token() {
        const start = pos;
        pos += 2;
        if (text.startsWith('//', pos)) {
            const end = text.indexOf('}}', pos);
            if (end < 0) throw new Error('Unclosed Vex comment.');
            pos = end + 2; return '//';
        }
        let depth = 1;
        while (pos < text.length) {
            if (text.startsWith('{{', pos)) { depth++; pos += 2; }
            else if (text.startsWith('}}', pos)) {
                depth--; pos += 2;
                if (!depth) return text.slice(start + 2, pos - 2);
            } else pos++;
        }
        throw new Error('Unclosed Vex macro.');
    }
    function argumentsOf(raw) {
        const result = []; let depth = 0, start = 0;
        for (let i = 0; i < raw.length; i++) {
            if (raw.startsWith('{{', i)) { depth++; i++; }
            else if (raw.startsWith('}}', i)) { depth--; i++; }
            else if (!depth && raw.startsWith('::', i)) { result.push(raw.slice(start, i)); start = i + 2; i++; }
        }
        result.push(raw.slice(start)); return result;
    }
    function sequence(ending = null, depth = 0) {
        if (depth > 40) throw new Error('Vex macro nesting exceeds the supported limit.');
        const result = [];
        while (pos < text.length) {
            const start = text.indexOf('{{', pos);
            if (start < 0) { result.push(text.slice(pos)); pos = text.length; break; }
            if (start > pos) result.push(text.slice(pos, start));
            pos = start;
            const raw = token();
            if (raw === '//') continue;
            if (raw === ending || (ending === '/if' && raw === 'else')) return { result, stop: raw };
            if (raw.startsWith('/') || raw === 'else') throw new Error('Unexpected Vex closing macro.');
            if (++nodes > 25000) throw new Error('Vex program exceeds the supported node count.');
            if (raw.startsWith('#if ')) {
                const then = sequence('/if', depth + 1);
                const otherwise = then.stop === 'else' ? sequence('/if', depth + 1) : { result: [], stop: then.stop };
                if (otherwise.stop !== '/if') throw new Error('Unclosed Vex condition.');
                result.push({ op: 'if', condition: compile(raw.slice(4)), yes: then.result, no: otherwise.result });
            } else if (raw.startsWith('#setvar::')) {
                const body = sequence('/setvar', depth + 1);
                if (body.stop !== '/setvar') throw new Error('Unclosed Vex setter.');
                result.push({ op: 'setvar', args: [compile(raw.slice(9)), body.result] });
            } else if (raw.startsWith('.')) {
                const m = /^\.([A-Za-z][\w]*)\s*(==|!=|<=|>=|<|>)\s*([\s\S]*)$/.exec(raw);
                if (!m) throw new Error('Unsupported Vex expression.');
                result.push({ op: 'compare', name: m[1], operator: m[2], rhs: compile(m[3]) });
            } else {
                const [op, ...args] = argumentsOf(raw);
                if (!['getvar', 'setvar', 'addvar', 'trim', 'char', 'user'].includes(op)) throw new Error(`Unsupported Vex macro: ${op}`);
                const expected = { getvar: 1, setvar: 2, addvar: 2, trim: 0, char: 0, user: 0 }[op];
                if (args.length !== expected) throw new Error('Unsupported Vex macro argument count.');
                result.push({ op, args: args.map(compile) });
            }
        }
        if (ending) throw new Error('Unclosed Vex scope.');
        return { result, stop: null };
    }
    return sequence().result;
}

export const truthy = value => !['', '0', 'false', 'off', 'no'].includes(String(value).toLowerCase());
const nativeValue = value => {
    const s = String(value ?? '');
    return s.trim() !== '' && !Number.isNaN(Number(s)) ? String(Number(s)) : s;
};

export function execute(program, state, library = {}, reads = new Set(), { maxSteps = 200000 } = {}) {
    let steps = 0;
    const get = name => {
        if (Object.hasOwn(state, name)) return nativeValue(state[name]);
        if (Object.hasOwn(library, name)) { reads.add(name); return nativeValue(library[name]); }
        return '';
    };
    function run(items) {
        let output = '';
        for (const node of items) {
            if (++steps > maxSteps) throw new Error('Vex dependency preflight exceeded its work budget.');
            if (typeof node === 'string') { output += node; continue; }
            if (node.op === 'if') {
                let condition = run(node.condition);
                const invert = condition.startsWith('!');
                if (invert) condition = condition.slice(1);
                output += run(truthy(condition) !== invert ? node.yes : node.no);
                continue;
            }
            if (node.op === 'compare') {
                const left = get(node.name), right = run(node.rhs);
                const numeric = !Number.isNaN(Number(left)) && !Number.isNaN(Number(right));
                const a = numeric ? Number(left) : left, b = numeric ? Number(right) : right;
                const value = { '==': () => a === b, '!=': () => a !== b, '<': () => a < b, '>': () => a > b, '<=': () => a <= b, '>=': () => a >= b }[node.operator]();
                output += value ? 'true' : 'false'; continue;
            }
            const args = node.args.map(run);
            if (node.op === 'getvar') output += get(args[0]);
            else if (node.op === 'setvar') state[args[0]] = args[1];
            else if (node.op === 'addvar') {
                const old = get(args[0]) || '0';
                state[args[0]] = Number.isNaN(Number(old)) || Number.isNaN(Number(args[1])) ? old + args[1] : String(Number(old) + Number(args[1]));
            } else if (node.op === 'user' || node.op === 'char') output += node.op;
            // trim has no bearing on library selection. The native engine owns output whitespace.
        }
        return output;
    }
    return run(program);
}
