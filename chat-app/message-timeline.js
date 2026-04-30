/** Show a time divider after ~1 hour or when the calendar day changes. */
export const SEPARATOR_GAP_MS = 60 * 60 * 1000;

export function sameCalendarDay(tsA, tsB) {
  const a = new Date(tsA);
  const b = new Date(tsB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function timeAmPm(ts) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * @param {number} curPublished
 * @param {number | null} prevPublished — previous message in thread (older); null for first message.
 */
export function formatSeparatorLabel(curPublished, prevPublished) {
  const curDate = new Date(curPublished);
  const timeOnly = timeAmPm(curPublished);

  if (prevPublished != null && sameCalendarDay(curPublished, prevPublished)) {
    return timeOnly;
  }

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startCur = new Date(
    curDate.getFullYear(),
    curDate.getMonth(),
    curDate.getDate(),
  ).getTime();
  const dayDiff = Math.round((startToday - startCur) / 86400000);

  if (dayDiff === 0) return timeOnly;
  if (dayDiff === 1) return `Yesterday ${timeOnly}`;

  const mm = String(curDate.getMonth() + 1).padStart(2, "0");
  const dd = String(curDate.getDate()).padStart(2, "0");
  const yy = String(curDate.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy} ${timeOnly}`;
}

/** @param {object[]} messagesAsc Graffiti message objects, oldest first */
export function buildMessageTimeline(messagesAsc, gapMs) {
  const items = [];
  for (let i = 0; i < messagesAsc.length; i++) {
    const cur = messagesAsc[i];
    const prev = i > 0 ? messagesAsc[i - 1] : null;
    const prevTs = prev ? prev.value.published : null;
    const curTs = cur.value.published;
    const gap = prev ? curTs - prevTs : Infinity;
    const differentDay = prev && !sameCalendarDay(curTs, prevTs);
    const longGap = gap > gapMs;
    if (!prev || differentDay || longGap) {
      items.push({
        kind: "separator",
        key: `sep-${cur.url}`,
        label: formatSeparatorLabel(curTs, prevTs),
      });
    }
    items.push({
      kind: "message",
      key: cur.url,
      object: cur,
    });
  }
  return items;
}
