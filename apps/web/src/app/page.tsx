'use client';

import { Spreadsheet } from '@/components/spreadsheet';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/>
          </svg>
          <span>JaSheets</span>
        </div>
        <div className={styles.title}>
          <input 
            type="text" 
            defaultValue="Untitled Spreadsheet" 
            className={styles.titleInput}
          />
        </div>
        <div className={styles.actions}>
          <button className={styles.shareButton}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
            </svg>
            Share
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <Spreadsheet
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
