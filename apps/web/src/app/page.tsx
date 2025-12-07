'use client';

import { Spreadsheet } from '@/components/spreadsheet';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <Spreadsheet
          title="Untitled Spreadsheet"
          initialData={{
            0: {
              0: { value: 'Item' },
              1: { value: 'Quantity' },
              2: { value: 'Price' },
              3: { value: 'Total' },
            },
            1: {
              0: { value: 'Apple' },
              1: { value: 10 },
              2: { value: 1.5 },
              3: { value: 15, formula: '=B2*C2' },
            },
            2: {
              0: { value: 'Banana' },
              1: { value: 20 },
              2: { value: 0.75 },
              3: { value: 15, formula: '=B3*C3' },
            },
            3: {
              0: { value: 'Orange' },
              1: { value: 15 },
              2: { value: 2.0 },
              3: { value: 30, formula: '=B4*C4' },
            },
            4: {
              0: { value: 'Total' },
              3: { value: 60, formula: '=SUM(D2:D4)' },
            },
          }}
        />
      </main>
    </div>
  );
}
