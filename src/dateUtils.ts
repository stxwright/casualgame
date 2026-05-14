export const LAUNCH_DATE = new Date('2026-02-14T00:00:00Z');

export const getPuzzleNumber = (dateInput: string | Date): number => {
  const date = typeof dateInput === 'string' 
    ? new Date(dateInput + 'T00:00:00Z') 
    : dateInput;
  return Math.floor((date.getTime() - LAUNCH_DATE.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};

export const formatDate = (dateInput: string | Date, options: Intl.DateTimeFormatOptions = {}): string => {
  const date = typeof dateInput === 'string' 
    ? new Date(dateInput + 'T12:00:00Z') 
    : dateInput;
    
  return date.toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options
  });
};
