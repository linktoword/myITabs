/**
 * 天气文案和时间的展示格式。
 */

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function formatPublishTime(obsTime) {
  const date = new Date(obsTime || '');
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

export function formatHourLabel(fxTime) {
  const date = new Date(fxTime || '');
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getHours()}时`;
}

/** indexFromToday：0 今天，1 明天，其余用星期 */
export function formatDayLabel(fxDate, indexFromToday) {
  if (indexFromToday === 0) return '今天';
  if (indexFromToday === 1) return '明天';
  const date = new Date(`${fxDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return WEEKDAYS[date.getDay()];
}

export function formatMonthDay(fxDate) {
  const date = new Date(`${fxDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatWindScale(scale) {
  if (!scale) return '';
  const text = String(scale);
  return text.includes('级') ? text : `${text}级`;
}
