interface ClinicalBannerProps {
  type: 'allergy-critical' | 'allergy-moderate' | 'alert';
  title: string;
  description: string;
  verifiedBy?: string;
  verifiedDate?: string;
}

const variants = {
  'allergy-critical': {
    wrapper: 'bg-rose-500/[0.08] border-rose-500/[0.3] animate-critical-pulse',
    iconBg: 'bg-rose-500/20',
    iconColor: 'text-rose-400',
    labelColor: 'text-rose-400',
    descColor: 'text-rose-300',
  },
  'allergy-moderate': {
    wrapper: 'bg-amber-500/[0.08] border-amber-500/[0.3]',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    labelColor: 'text-amber-400',
    descColor: 'text-amber-300',
  },
  alert: {
    wrapper: 'bg-aqua-500/[0.08] border-aqua-500/[0.3]',
    iconBg: 'bg-aqua-500/20',
    iconColor: 'text-aqua-400',
    labelColor: 'text-aqua-400',
    descColor: 'text-aqua-300',
  },
};

export function ClinicalBanner({
  type,
  title,
  description,
  verifiedBy,
  verifiedDate,
}: ClinicalBannerProps) {
  const v = variants[type];

  return (
    <div className={`relative flex items-start gap-3 px-4 py-3 rounded-lg ${v.wrapper} sticky top-14 z-40`}>
      {/* Icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${v.iconBg}`}>
        <svg className={`w-4 h-4 ${v.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold uppercase tracking-widest mb-0.5 ${v.labelColor}`}>
          {title}
        </p>
        <p className={`text-sm font-medium ${v.descColor}`}>
          {description}
        </p>
        {verifiedBy && (
          <p className="text-xs text-on-surface-variant/60 mt-0.5">
            Verificado por {verifiedBy}{verifiedDate ? ` · ${verifiedDate}` : ''}
          </p>
        )}
      </div>

      {/* No close button — BR-PAT-006 (critical allergy banners are not dismissible) */}
    </div>
  );
}
