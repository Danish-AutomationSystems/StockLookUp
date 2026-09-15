const ABSOLUTE_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZoneName: 'short',
});

export function formatAbsoluteTime(isoString: string): string {
  return ABSOLUTE_TIME_FORMATTER.format(new Date(isoString));
}
