// A small JSON-schema check for the shapes the bridge asks the model for: object / array / string /
// integer / number / boolean, required, properties, additionalProperties: false, items, enum, maxLength.
// Returns a list of problems (empty = valid). No dependency, so it runs the same with or without a key.
function validate(schema, value, path = '$') {
  const problems = [];
  const type = schema.type;
  const is = {
    object: v => v && typeof v === 'object' && !Array.isArray(v),
    array: Array.isArray,
    string: v => typeof v === 'string',
    integer: Number.isInteger,
    number: v => typeof v === 'number' && Number.isFinite(v),
    boolean: v => typeof v === 'boolean',
  };
  if (type && !(type in is)) problems.push(`${path}: unknown schema type ${type}`);
  else if (type && !is[type](value)) { problems.push(`${path}: expected ${type}`); return problems; }

  if (schema.enum && !schema.enum.includes(value)) problems.push(`${path}: not one of ${schema.enum.join(', ')}`);
  if (schema.maxLength && typeof value === 'string' && value.length > schema.maxLength) problems.push(`${path}: too long`);

  if (type === 'object') {
    for (const k of schema.required || []) if (!(k in value)) problems.push(`${path}.${k}: missing`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties && schema.properties[k]) problems.push(...validate(schema.properties[k], v, `${path}.${k}`));
      else if (schema.additionalProperties === false) problems.push(`${path}.${k}: not allowed`);
    }
  }
  if (type === 'array' && schema.items) value.forEach((v, i) => problems.push(...validate(schema.items, v, `${path}[${i}]`)));
  return problems;
}

module.exports = { validate };
