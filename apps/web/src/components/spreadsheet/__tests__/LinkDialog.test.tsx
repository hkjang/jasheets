import { fireEvent, render, screen } from '@testing-library/react';
import LinkDialog from '../LinkDialog';

describe('LinkDialog', () => {
  const onApply = jest.fn();
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows initial values and applies a safe URL', () => {
    render(
      <LinkDialog
        initialText="JaSheets"
        initialUrl="https://example.com/sheet"
        onApply={onApply}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('dialog', { name: '링크 삽입' })).toBeInTheDocument();
    expect(screen.getByLabelText('표시할 텍스트')).toHaveValue('JaSheets');
    fireEvent.click(screen.getByRole('button', { name: '적용' }));

    expect(onApply).toHaveBeenCalledWith({
      text: 'JaSheets',
      url: 'https://example.com/sheet',
    });
  });

  it('uses the URL as display text when text is empty', () => {
    render(
      <LinkDialog initialText="" initialUrl="mailto:user@example.com" onApply={onApply} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(onApply).toHaveBeenCalledWith({
      text: 'mailto:user@example.com',
      url: 'mailto:user@example.com',
    });
  });

  it('blocks unsafe schemes and reports the validation error', () => {
    render(
      <LinkDialog initialText="Unsafe" initialUrl="javascript:alert(1)" onApply={onApply} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '적용' }));

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('http, https 또는 유효한 mailto');
    expect(screen.getByLabelText('링크')).toHaveAttribute('aria-invalid', 'true');
  });

  it('closes with Escape or the cancel button', () => {
    const { rerender } = render(
      <LinkDialog initialText="" initialUrl="" onApply={onApply} onClose={onClose} />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<LinkDialog initialText="" initialUrl="" onApply={onApply} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
