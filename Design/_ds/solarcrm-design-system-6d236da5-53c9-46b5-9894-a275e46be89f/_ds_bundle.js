/* @ds-bundle: {"format":3,"namespace":"SolarCRMDesignSystem_6d236d","components":[{"name":"Button","sourcePath":"components/actions/Button.jsx"},{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"Badge","sourcePath":"components/feedback/Badge.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Card","sourcePath":"components/layout/Card.jsx"}],"sourceHashes":{"components/actions/Button.jsx":"4da96c623f3b","components/data/Table.jsx":"19604fe00c4b","components/feedback/Badge.jsx":"495a26b6a8cd","components/forms/Input.jsx":"54ae714a46b9","components/layout/Card.jsx":"4bf442ab48d7"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.SolarCRMDesignSystem_6d236d = window.SolarCRMDesignSystem_6d236d || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/actions/Button.jsx
try { (() => {
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  iconLeft,
  iconRight,
  onClick,
  href,
  children
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    border: '1px solid transparent',
    borderRadius: '0',
    fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 500,
    letterSpacing: '-0.01em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    userSelect: 'none',
    transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
    pointerEvents: disabled ? 'none' : 'auto'
  };
  const sizes = {
    sm: {
      fontSize: '11px',
      padding: '0 10px',
      height: '28px'
    },
    md: {
      fontSize: '13px',
      padding: '0 14px',
      height: '32px'
    },
    lg: {
      fontSize: '14px',
      padding: '0 18px',
      height: '38px'
    }
  };
  const variants = {
    primary: {
      background: '#C98A0A',
      borderColor: '#C98A0A',
      color: '#fff'
    },
    secondary: {
      background: 'transparent',
      borderColor: '#D6D2CB',
      color: '#11100E'
    },
    ghost: {
      background: 'transparent',
      borderColor: 'transparent',
      color: '#11100E'
    },
    destructive: {
      background: '#D13B1E',
      borderColor: '#D13B1E',
      color: '#fff'
    }
  };
  const [hovered, setHovered] = React.useState(false);
  const hoverOverrides = {
    primary: hovered ? {
      background: '#A56E08',
      borderColor: '#A56E08'
    } : {},
    secondary: hovered ? {
      background: 'rgba(0,0,0,0.04)'
    } : {},
    ghost: hovered ? {
      background: 'rgba(0,0,0,0.04)'
    } : {},
    destructive: hovered ? {
      background: '#9E2B14',
      borderColor: '#9E2B14'
    } : {}
  };
  const style = {
    ...base,
    ...sizes[size],
    ...variants[variant],
    ...hoverOverrides[variant]
  };
  const props = {
    style,
    disabled,
    onClick,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false)
  };
  if (href) {
    return React.createElement('a', {
      ...props,
      href
    }, iconLeft, children, iconRight);
  }
  return React.createElement('button', {
    ...props,
    type: 'button'
  }, iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Button.jsx", error: String((e && e.message) || e) }); }

// components/data/Table.jsx
try { (() => {
function Table({
  columns = [],
  rows = [],
  rowKey = 'id',
  emptyMessage = 'Sin resultados',
  onRowClick
}) {
  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: "'IBM Plex Sans', sans-serif"
  };
  const thStyle = align => ({
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#5C574F',
    padding: '10px 12px',
    borderBottom: '1px solid #E9E6E0',
    textAlign: align || 'left',
    whiteSpace: 'nowrap',
    background: '#FFFFFF'
  });
  const tdStyle = align => ({
    fontSize: '14px',
    color: '#11100E',
    padding: '12px',
    borderBottom: '1px solid #F3F1EC',
    verticalAlign: 'middle',
    textAlign: align || 'left'
  });
  const [hoveredRow, setHoveredRow] = React.useState(null);
  if (!rows.length) {
    return React.createElement('div', {
      style: {
        padding: '40px',
        textAlign: 'center',
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: '14px',
        color: '#A9A49C'
      }
    }, emptyMessage);
  }
  return React.createElement('table', {
    style: tableStyle
  }, React.createElement('thead', null, React.createElement('tr', null, ...columns.map(col => React.createElement('th', {
    key: col.key,
    style: thStyle(col.align)
  }, col.label)))), React.createElement('tbody', null, ...rows.map((row, i) => {
    const key = row[rowKey] != null ? row[rowKey] : i;
    const isHovered = hoveredRow === key;
    return React.createElement('tr', {
      key,
      style: {
        cursor: onRowClick ? 'pointer' : 'default'
      },
      onMouseEnter: () => setHoveredRow(key),
      onMouseLeave: () => setHoveredRow(null),
      onClick: onRowClick ? () => onRowClick(row) : undefined
    }, ...columns.map(col => React.createElement('td', {
      key: col.key,
      style: {
        ...tdStyle(col.align),
        background: isHovered ? '#F8F7F4' : 'transparent',
        ...(i === rows.length - 1 ? {
          borderBottom: 'none'
        } : {})
      }
    }, col.render ? col.render(row[col.key], row) : row[col.key] != null ? String(row[col.key]) : '—')));
  })));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Badge.jsx
try { (() => {
function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  children
}) {
  const variants = {
    default: {
      background: '#F3F1EC',
      color: '#5C574F',
      dotColor: '#A9A49C'
    },
    brand: {
      background: '#FEF8E7',
      color: '#7E5407',
      dotColor: '#C98A0A'
    },
    success: {
      background: '#ECFAED',
      color: '#1A6629',
      dotColor: '#25913A'
    },
    error: {
      background: '#FDEEED',
      color: '#9E2B14',
      dotColor: '#D13B1E'
    },
    warning: {
      background: '#FEF6E4',
      color: '#8F6010',
      dotColor: '#C68A10'
    },
    info: {
      background: '#EEF3FD',
      color: '#2A53A0',
      dotColor: '#3A72CB'
    }
  };
  const cfg = variants[variant];
  const isSmall = size === 'sm';
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: isSmall ? '2px 5px' : '3px 7px',
    borderRadius: '2px',
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: isSmall ? '11px' : '12px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    lineHeight: 1,
    background: cfg.background,
    color: cfg.color
  };
  const dotStyle = {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    flexShrink: 0,
    background: cfg.dotColor
  };
  return React.createElement('span', {
    style
  }, dot ? React.createElement('span', {
    style: dotStyle
  }) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Badge.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function Input({
  label,
  placeholder,
  value,
  onChange,
  helper,
  error,
  disabled = false,
  type = 'text',
  iconLeft,
  name,
  id
}) {
  const [focused, setFocused] = React.useState(false);
  const wrapStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%'
  };
  const labelStyle = {
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: '11px',
    fontWeight: 500,
    color: '#5C574F',
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
  };
  const fieldWrapStyle = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  };
  const fieldStyle = {
    width: '100%',
    height: '34px',
    padding: iconLeft ? '0 12px 0 34px' : '0 12px',
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: '14px',
    color: disabled ? '#A9A49C' : '#11100E',
    background: disabled ? '#F3F1EC' : '#FFFFFF',
    border: `1px solid ${error ? '#D13B1E' : focused ? '#C98A0A' : '#E9E6E0'}`,
    borderRadius: '0',
    outline: 'none',
    boxShadow: focused && !error ? '0 0 0 2px #F8F7F4, 0 0 0 4px #C98A0A' : 'none',
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
    cursor: disabled ? 'not-allowed' : 'text',
    opacity: disabled ? 0.6 : 1,
    boxSizing: 'border-box'
  };
  const iconWrapStyle = {
    position: 'absolute',
    left: '10px',
    display: 'flex',
    alignItems: 'center',
    color: '#A9A49C',
    pointerEvents: 'none'
  };
  const helperStyle = {
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: '12px',
    color: '#A9A49C'
  };
  const errorStyle = {
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: '12px',
    color: '#D13B1E'
  };
  return React.createElement('div', {
    style: wrapStyle
  }, label ? React.createElement('label', {
    style: labelStyle,
    htmlFor: id
  }, label) : null, React.createElement('div', {
    style: fieldWrapStyle
  }, iconLeft ? React.createElement('span', {
    style: iconWrapStyle
  }, iconLeft) : null, React.createElement('input', {
    id,
    name,
    type,
    placeholder,
    value,
    onChange,
    disabled,
    style: fieldStyle,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false)
  })), error ? React.createElement('span', {
    style: errorStyle
  }, error) : helper ? React.createElement('span', {
    style: helperStyle
  }, helper) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/layout/Card.jsx
try { (() => {
function Card({
  title,
  headerAction,
  noPadding = false,
  children,
  style = {}
}) {
  const cardStyle = {
    background: '#FFFFFF',
    border: '1px solid #E9E6E0',
    borderRadius: '0',
    boxShadow: '0 1px 2px rgba(30,20,5,0.04)',
    ...style
  };
  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid #E9E6E0'
  };
  const titleStyle = {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '16px',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: '#11100E',
    margin: 0
  };
  const bodyStyle = noPadding ? {} : {
    padding: '24px'
  };
  return React.createElement('div', {
    style: cardStyle
  }, title ? React.createElement('div', {
    style: headerStyle
  }, React.createElement('h3', {
    style: titleStyle
  }, title), headerAction || null) : null, React.createElement('div', {
    style: bodyStyle
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/Card.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Card = __ds_scope.Card;

})();
