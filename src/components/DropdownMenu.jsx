import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

const ITEM_TONES = {
  default: {
    icon: "bg-slate-100 text-slate-600 group-hover:bg-white group-focus:bg-white dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-slate-700 dark:group-focus:bg-slate-700",
    label: "text-slate-800 dark:text-slate-100",
    row: "hover:bg-slate-50 focus:bg-slate-50 dark:hover:bg-slate-800/70 dark:focus:bg-slate-800/70",
  },
  brand: {
    icon: "bg-blue-50 text-blue-600 group-hover:bg-white group-focus:bg-white dark:bg-blue-500/15 dark:text-blue-300 dark:group-hover:bg-blue-500/25 dark:group-focus:bg-blue-500/25",
    label: "text-slate-800 dark:text-slate-100",
    row: "hover:bg-blue-50/60 focus:bg-blue-50/60 dark:hover:bg-blue-500/10 dark:focus:bg-blue-500/10",
  },
  warning: {
    icon: "bg-amber-50 text-amber-600 group-hover:bg-white group-focus:bg-white dark:bg-amber-500/15 dark:text-amber-300 dark:group-hover:bg-amber-500/25 dark:group-focus:bg-amber-500/25",
    label: "text-amber-700 dark:text-amber-300",
    row: "hover:bg-amber-50/70 focus:bg-amber-50/70 dark:hover:bg-amber-500/10 dark:focus:bg-amber-500/10",
  },
  danger: {
    icon: "bg-red-50 text-red-600 group-hover:bg-white group-focus:bg-white dark:bg-red-500/15 dark:text-red-300 dark:group-hover:bg-red-500/25 dark:group-focus:bg-red-500/25",
    label: "text-red-600 dark:text-red-300",
    row: "hover:bg-red-50/70 focus:bg-red-50/70 dark:hover:bg-red-500/10 dark:focus:bg-red-500/10",
  },
};

const GAP = 8;

// Accessible dropdown menu rendered in a portal (never clipped by a scrolling
// table), anchored to its trigger, flipping above it when there is no room below.
//
// sections: [{ key, title?, items: [{ key, label, description?, icon?, tone?, to?, onSelect? }] }]
export default function DropdownMenu({ renderTrigger, header, sections, width = 288, align = "end", label }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const visibleSections = sections
    .map((section) => ({ ...section, items: section.items.filter(Boolean) }))
    .filter((section) => section.items.length);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    setPosition(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const computePosition = useCallback(
    (menuHeight = 0) => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = menuHeight > 0 && spaceBelow < menuHeight + GAP * 2 && rect.top > spaceBelow;
      const left =
        align === "end"
          ? Math.max(GAP, Math.min(rect.right - width, window.innerWidth - width - GAP))
          : Math.max(GAP, Math.min(rect.left, window.innerWidth - width - GAP));
      return {
        left,
        top: openUp ? Math.max(GAP, rect.top - menuHeight - GAP) : rect.bottom + GAP,
        origin: openUp ? "bottom" : "top",
      };
    },
    [align, width]
  );

  const toggle = () => {
    if (open) {
      close(false);
      return;
    }
    setPosition(computePosition());
    setOpen(true);
  };

  // Once rendered, measure the menu and flip it above the trigger if needed.
  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    setPosition(computePosition(menuRef.current.offsetHeight));
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return undefined;
    const firstItem = menuRef.current?.querySelector('[role="menuitem"]');
    firstItem?.focus({ preventScroll: true });

    const onPointerDown = (event) => {
      if (menuRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      close(false);
    };
    const onScroll = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  const onMenuKeyDown = (event) => {
    const items = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') || []);
    const index = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      close(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  const select = (item) => {
    close(!item.to);
    item.onSelect?.();
  };

  return (
    <>
      {renderTrigger({
        ref: triggerRef,
        open,
        props: {
          onClick: toggle,
          "aria-haspopup": "menu",
          "aria-expanded": open,
          "aria-controls": open ? menuId : undefined,
          "aria-label": label,
          onKeyDown: (event) => {
            if (event.key === "ArrowDown" && !open) {
              event.preventDefault();
              toggle();
            }
          },
        },
      })}
      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              onKeyDown={onMenuKeyDown}
              style={{ position: "fixed", top: position.top, left: position.left, width }}
              className={`z-[80] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/5 animate-kpi-pop dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/50 dark:ring-black/20 ${
                position.origin === "bottom" ? "origin-bottom" : "origin-top"
              }`}
            >
              {header ? (
                <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                  {header}
                </div>
              ) : null}
              <div className="py-1.5">
                {visibleSections.map((section, sectionIndex) => (
                  <div
                    key={section.key}
                    role="group"
                    aria-label={section.title}
                    className={sectionIndex > 0 ? "mt-1.5 border-t border-slate-100 pt-1.5 dark:border-slate-800" : ""}
                  >
                    {section.title ? (
                      <div className="px-4 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                        {section.title}
                      </div>
                    ) : null}
                    {section.items.map((item) => {
                      const tone = ITEM_TONES[item.tone] || ITEM_TONES.default;
                      const ItemIcon = item.icon;
                      const content = (
                        <>
                          {ItemIcon ? (
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${tone.icon}`}
                            >
                              <ItemIcon size={16} />
                            </span>
                          ) : null}
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm font-semibold ${tone.label}`}>{item.label}</span>
                            {item.description ? (
                              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{item.description}</span>
                            ) : null}
                          </span>
                        </>
                      );
                      const className = `group mx-1.5 flex items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition ${tone.row}`;
                      return item.to ? (
                        <Link
                          key={item.key}
                          to={item.to}
                          role="menuitem"
                          tabIndex={-1}
                          onClick={() => select(item)}
                          className={className}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          key={item.key}
                          type="button"
                          role="menuitem"
                          tabIndex={-1}
                          onClick={() => select(item)}
                          className={`${className} w-[calc(100%-0.75rem)]`}
                        >
                          {content}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
