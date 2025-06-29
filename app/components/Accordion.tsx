// Accordion.tsx
import React, { useState, ReactNode } from 'react';
import { CaretRight, CaretDown } from '@phosphor-icons/react';
import styles from './Accordion.module.css';

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

const Accordion: React.FC<AccordionProps> = ({
  title,
  children,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={styles.accordion}>
      <button
        className={styles.header}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className={styles.title}>{title}</span>

        {/* chevron on the right */}
        {open ? (
          <CaretDown size={32} className={styles.chevron} />
        ) : (
          <CaretRight size={32} className={styles.chevron} />
        )}
      </button>

      {open && <div className={styles.body}>{children}</div>}
    </div>
  );
};

export default Accordion;