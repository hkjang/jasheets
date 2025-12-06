'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './AIAssistant.module.css';

interface FormulaResult {
  formula: string;
  explanation: string;
  confidence: number;
  alternatives?: string[];
}

interface AIAssistantProps {
  onFormulaInsert: (formula: string) => void;
  selectedRange?: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  sheetName: string;
  apiUrl?: string;
}

export default function AIAssistant({
  onFormulaInsert,
  selectedRange,
  sheetName,
  apiUrl = 'http://localhost:4000/api',
}: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FormulaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'formula' | 'analysis'>('formula');
  const [analysisResult, setAnalysisResult] = useState<{
    summary: string;
    trends: string[];
    recommendations: string[];
  } | null>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setAnalysisResult(null);

    try {
      const endpoint = mode === 'formula' ? '/ai/formula/generate' : '/ai/data/analyze';
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add auth header if needed
        },
        body: JSON.stringify({
          prompt,
          context: {
            selectedRange,
            sheetName,
            mode,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process request');
      }

      const data = await response.json();
      
      if (mode === 'formula') {
        setResult(data);
      } else {
        setAnalysisResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsert = (formula: string) => {
    onFormulaInsert(formula);
    setIsOpen(false);
    setPrompt('');
    setResult(null);
  };

  const formulaSuggestions = [
    '이 범위의 합계를 구해줘',
    '평균값을 계산해줘',
    '가장 큰 값을 찾아줘',
    '조건에 맞는 데이터만 합산해줘',
  ];

  const analysisSuggestions = [
    '이 데이터의 주요 트렌드를 알려줘',
    '이상치가 있는지 확인해줘',
    '데이터를 어떻게 시각화하면 좋을까?',
    '매출 성장률을 분석해줘',
  ];

  return (
    <div className={styles.container}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        title="AI 도우미"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span>AI</span>
      </button>

      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <h3>✨ AI 도우미</h3>
            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>

          <div className={styles.tabs} style={{ display: 'flex', gap: '8px', padding: '0 16px 16px', borderBottom: '1px solid #eee' }}>
            <button 
              onClick={() => setMode('formula')}
              style={{ 
                flex: 1, 
                padding: '8px', 
                borderRadius: '6px',
                border: 'none',
                background: mode === 'formula' ? '#e8f0fe' : 'transparent',
                color: mode === 'formula' ? '#1967d2' : '#5f6368',
                fontWeight: mode === 'formula' ? 600 : 400,
                cursor: 'pointer'
              }}
            >
              수식 생성
            </button>
            <button 
              onClick={() => setMode('analysis')}
              style={{ 
                flex: 1, 
                padding: '8px', 
                borderRadius: '6px',
                border: 'none',
                background: mode === 'analysis' ? '#e8f0fe' : 'transparent',
                color: mode === 'analysis' ? '#1967d2' : '#5f6368',
                fontWeight: mode === 'analysis' ? 600 : 400,
                cursor: 'pointer'
              }}
            >
              데이터 분석
            </button>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={mode === 'formula' ? "원하는 수식을 설명하세요..." : "데이터에 대해 궁금한 점을 물어보세요..."}
              className={styles.input}
            />
            <button 
              type="submit" 
              className={styles.submitBtn}
              disabled={isLoading || !prompt.trim()}
            >
              {isLoading ? '생성 중...' : '생성'}
            </button>
          </form>

          {!result && !analysisResult && !error && (
            <div className={styles.suggestions}>
              <p>예시:</p>
              {(mode === 'formula' ? formulaSuggestions : analysisSuggestions).map((s, i) => (
                <button
                  key={i}
                  className={styles.suggestion}
                  onClick={() => setPrompt(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          {mode === 'formula' && result && (
            <div className={styles.result}>
              <div className={styles.formula}>
                <code>{result.formula}</code>
                <button
                  className={styles.insertBtn}
                  onClick={() => handleInsert(result.formula)}
                >
                  삽입
                </button>
              </div>
              
              <p className={styles.explanation}>{result.explanation}</p>
              
              <div className={styles.confidence}>
                신뢰도: {Math.round(result.confidence * 100)}%
              </div>

              {result.alternatives && result.alternatives.length > 0 && (
                <div className={styles.alternatives}>
                  <p>대안:</p>
                  {result.alternatives.map((alt, i) => (
                    <button
                      key={i}
                      className={styles.altBtn}
                      onClick={() => handleInsert(alt)}
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'analysis' && analysisResult && (
            <div className={styles.result}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>📊 분석 요약</h4>
              <p className={styles.explanation}>{analysisResult.summary}</p>
              
              {analysisResult.trends.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>📈 트렌드</h4>
                  <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '13px', color: '#333' }}>
                    {analysisResult.trends.map((t, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysisResult.recommendations.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>💡 제안</h4>
                  <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '13px', color: '#333' }}>
                    {analysisResult.recommendations.map((r, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
