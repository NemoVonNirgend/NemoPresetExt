/** Fingerprint executable structure while allowing changes to display prose and comments. */
function staticName(program) {
    return program.every(node => typeof node === 'string') ? program.join('') : null;
}

export function programShape(program, context = 'output') {
    return program.flatMap(node => {
        if (typeof node === 'string') return context === 'value' ? [node] : [];
        if (node.op === 'if') return [{ op: 'if', condition: programShape(node.condition, 'value'),
            yes: programShape(node.yes, context), no: programShape(node.no, context) }];
        if (node.op === 'compare') return [{ ...node, rhs: programShape(node.rhs, 'value') }];
        if (node.op === 'trim' && context !== 'value') return [];
        const name = node.args?.[0] && staticName(node.args[0]);
        const display = node.op === 'setvar' && /^(?:Vex|NemoVex)[A-Za-z0-9_]*$/.test(name ?? '');
        return [{ op: node.op, args: node.args.map((arg, i) => programShape(arg, display && i === 1 ? 'prose' : 'value')) }];
    });
}

// Generated from the inspected bundled v12.1 programs. These describe macro
// structure, not source spelling. Exact source hashes still protect stored data.
export const CONTROL_SHAPES = Object.freeze({
    "nemo-init-vex-reset-01": [
        "f4a95aeb405c5333c8ceaec4ed0d9480296158c342a033592f7e4a4b2d97f5c3"
    ],
    "nemo-vc-resolve-selection": [
        "16c6ca16205c1a3ce996787b5dd057eadba15aed2185387e7e2697fa61804ad0"
    ],
    "nemo-vc-assemble-selected": [
        "336c900d27d3ebaf3b25c636582f5400f13db44f8e6e28e1995a12b9b41365f0",
        "94475efc7e154ed5e92f33048ae1ece86f933a0b5e616047197ff665cf4d4aea"
    ]
});
