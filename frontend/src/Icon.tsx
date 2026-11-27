const paths = {
  document: <><rect x="3" y="2" width="18" height="20" rx="1" /><path d="M6 6h12M6 10h12M6 14h12M6 18h12" /></>,
  upload: <path d="M12 21V3m-5 5 5-5 5 5" />,
  download: <><path d="M12 4v12m-5-5 5 5 5-5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
}

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}
