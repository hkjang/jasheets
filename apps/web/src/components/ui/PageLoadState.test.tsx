import { fireEvent, render, screen } from '@testing-library/react';
import {
  SpreadsheetErrorState,
  SpreadsheetLoadingState,
} from './PageLoadState';

describe('spreadsheet page states', () => {
  it('announces loading without presenting an empty screen', () => {
    render(<SpreadsheetLoadingState />);

    expect(screen.getByRole('status', { name: '스프레드시트를 불러오는 중' })).toBeInTheDocument();
    expect(screen.getByText('문서와 계산 상태를 안전하게 불러오고 있습니다…')).toBeInTheDocument();
  });

  it('offers recovery and navigation actions after a load failure', () => {
    const onRetry = jest.fn();
    const onBack = jest.fn();
    render(
      <SpreadsheetErrorState
        title="스프레드시트를 열 수 없습니다"
        message="서버 응답이 지연되고 있습니다."
        onRetry={onRetry}
        onBack={onBack}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('서버 응답이 지연되고 있습니다.');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    fireEvent.click(screen.getByRole('button', { name: '대시보드로 이동' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
