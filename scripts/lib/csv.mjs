export function parseCsv(content) {
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;

  const source = content.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }

      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field.replace(/\r$/u, ""));
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("CSV contains an unterminated quoted field.");
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field.replace(/\r$/u, ""));
    records.push(record);
  }

  const nonEmptyRecords = records.filter((item) =>
    item.some((value) => value.trim().length > 0),
  );

  if (nonEmptyRecords.length === 0) {
    throw new Error("CSV is empty.");
  }

  const [headers, ...dataRecords] = nonEmptyRecords;

  if (new Set(headers).size !== headers.length) {
    throw new Error("CSV contains duplicate headers.");
  }

  return {
    headers,
    rows: dataRecords.map((values, index) => {
      if (values.length !== headers.length) {
        throw new Error(
          `CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}.`,
        );
      }

      return Object.fromEntries(
        headers.map((header, headerIndex) => [header, values[headerIndex]]),
      );
    }),
  };
}

function escapeCsvValue(value) {
  const text = String(value ?? "");

  if (/[",\r\n]/u.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function stringifyCsv(headers, rows) {
  const lines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header])).join(","),
    ),
  ];

  return `${lines.join("\n")}\n`;
}