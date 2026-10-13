import { Fragment, type ReactNode } from "react";

/**
 * A small Markdown renderer for the coach's replies: headings, paragraphs,
 * bullet and numbered lists, pipe tables, horizontal rules, bold, italics and
 * inline code. Enough for sessions and assessments without a dependency.
 */

function inline(text: string, key = 0): ReactNode {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) parts.push(<strong key={`${key}-${i++}`}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) parts.push(<code key={`${key}-${i++}`}>{t.slice(1, -1)}</code>);
    else parts.push(<em key={`${key}-${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function isTableRow(line: string) {
  return /^\s*\|.*\|\s*$/.test(line);
}
function isSeparatorRow(line: string) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}
function splitRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(h[1].length + 1, 4);
      const content = inline(h[2], k);
      out.push(level === 2 ? <h2 key={k++}>{content}</h2> : level === 3 ? <h3 key={k++}>{content}</h3> : <h4 key={k++}>{content}</h4>);
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push(<hr key={k++} />);
      i++;
      continue;
    }

    if (isTableRow(line)) {
      const rows: string[][] = [];
      let header: string[] | null = null;
      while (i < lines.length && isTableRow(lines[i])) {
        if (isSeparatorRow(lines[i])) {
          if (rows.length && !header) header = rows.shift()!;
        } else rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(
        <div className="table-wrap" key={k++}>
          <table>
            {header && (
              <thead>
                <tr>{header.map((c, ci) => <th key={ci}>{inline(c, ci)}</th>)}</tr>
              </thead>
            )}
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci}>{inline(c, ci)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const bullet = /^\s*[-*•]\s+/;
    const number = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || number.test(line)) {
      const ordered = number.test(line);
      const re = ordered ? number : bullet;
      const items: ReactNode[] = [];
      while (i < lines.length && re.test(lines[i])) {
        let item = lines[i].replace(re, "");
        i++;
        // Continuation lines indented under the item.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !re.test(lines[i]) && !bullet.test(lines[i]) && !number.test(lines[i])) {
          item += " " + lines[i].trim();
          i++;
        }
        items.push(<li key={items.length}>{inline(item, items.length)}</li>);
      }
      out.push(ordered ? <ol key={k++}>{items}</ol> : <ul key={k++}>{items}</ul>);
      continue;
    }

    // Paragraph: gather until a blank line or a block start.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !isTableRow(lines[i]) &&
      !bullet.test(lines[i]) &&
      !number.test(lines[i]) &&
      !/^\s*(-{3,}|\*{3,})\s*$/.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) out.push(<p key={k++}>{inline(para.join(" "), k)}</p>);
  }

  return <Fragment>{out}</Fragment>;
}
