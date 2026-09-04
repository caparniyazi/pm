type IconProps = {
  className?: string;
};

export const PencilIcon = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M13.5 3.5a1.7 1.7 0 0 1 2.4 2.4L7 15l-3.2.7L4.5 12.5 13.5 3.5Z" />
  </svg>
);

export const TrashIcon = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 6h12" />
    <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6" />
    <path d="M5.5 6 6.2 16a1.5 1.5 0 0 0 1.5 1.4h4.6A1.5 1.5 0 0 0 13.8 16L14.5 6" />
    <path d="M8.3 9v5" />
    <path d="M11.7 9v5" />
  </svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M5 5l10 10M15 5 5 15" />
  </svg>
);

export const PlusIcon = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M10 4v12M4 10h12" />
  </svg>
);

export const ChatIcon = ({ className }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 10.2c0-3.7 3.1-6.7 7-6.7s7 3 7 6.7-3.1 6.7-7 6.7c-.9 0-1.8-.16-2.6-.46L4 17.5l1.2-3.1A6.4 6.4 0 0 1 3 10.2Z" />
  </svg>
);
