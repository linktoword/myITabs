/**
 * 和风天气填充图标。编号来自接口的 icon / iconDay。
 * https://icons.qweather.com/assets/icons/{code}-fill.svg
 */
export default function WeatherIcon({ code, className = 'h-6 w-6' }) {
  const safeCode = String(code || '').replace(/[^\d]/g, '');
  if (!safeCode) return <span className={`inline-block ${className}`} />;

  return (
    <img
      src={`https://icons.qweather.com/assets/icons/${safeCode}-fill.svg`}
      alt=""
      draggable={false}
      className={`${className} object-contain`}
      style={{ filter: 'brightness(0) invert(1)' }}
    />
  );
}
