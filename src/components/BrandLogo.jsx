// AVOCarbon Group logo. On the dark theme it switches to the reversed version
// (white "Carbon", same blue and orange): public/avocarbon-logo-dark.png.
// `product` adds the application name after a thin rule, as in the e-mails.
export default function BrandLogo({ className = "h-7", product = false }) {
  return (
    <span className="inline-flex items-center gap-3">
      <img src="/avocarbon-logo.png" alt="AVOCarbon Group" className={`${className} w-auto dark:hidden`} />
      <img src="/avocarbon-logo-dark.png" alt="AVOCarbon Group" className={`${className} hidden w-auto dark:block`} />
      {product ? (
        <>
          <span className="h-5 w-px bg-avo-rule dark:bg-slate-700" aria-hidden="true" />
          <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.18em] text-avo-gray dark:text-slate-300">
            KPI Manager
          </span>
        </>
      ) : null}
    </span>
  );
}
