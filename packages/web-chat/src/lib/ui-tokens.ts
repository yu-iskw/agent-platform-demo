export const borderLight = '1px solid #ccc';
export const borderRadius = 4;
export const panelPadding = '0.75rem';

export const colors = {
  activeBg: '#e8f0fe',
  activeText: '#1a73e8',
  okBg: '#e6f4ea',
  okText: '#137333',
  failBg: '#fce8e6',
  failText: '#c5221f',
  skipBg: '#f1f1f1',
  skipText: '#555',
  unknownBg: '#f8f9fa',
  unknownText: '#666',
} as const;

export function panelStyle(): React.CSSProperties {
  return {
    border: borderLight,
    borderRadius,
    padding: panelPadding,
  };
}

export function segmentedButtonStyle(selected: boolean): React.CSSProperties {
  return {
    background: selected ? colors.activeBg : '#fff',
    border: borderLight,
    color: selected ? colors.activeText : '#333',
    cursor: 'pointer',
    flex: 1,
    fontWeight: selected ? 600 : 400,
    padding: '0.4rem 0.6rem',
  };
}
