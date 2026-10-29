export function SectionHeading({ index, title, lead, id }: { index: string; title: string; lead?: string; id: string }) {
  return (
    <div className="grid grid-cols-12 items-end gap-y-6 md:gap-x-8">
      <div className="col-span-12 md:col-span-8">
        <p className="eyebrow mb-6 text-champagne">({index})</p>
        <h2 id={id} className="display text-[clamp(3rem,8vw,8rem)] uppercase">
          {title}
        </h2>
      </div>
      {lead && <p className="col-span-12 max-w-sm text-sm leading-relaxed text-mist md:col-span-4 md:justify-self-end">{lead}</p>}
    </div>
  );
}
