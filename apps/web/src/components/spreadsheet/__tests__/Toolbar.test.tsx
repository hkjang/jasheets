import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar from '../Toolbar';

describe('Toolbar', () => {
  const defaultProps = {
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    onBold: jest.fn(),
    onItalic: jest.fn(),
    onUnderline: jest.fn(),
    onAlignLeft: jest.fn(),
    onAlignCenter: jest.fn(),
    onAlignRight: jest.fn(),
    onFormat: jest.fn(),
    canUndo: true,
    canRedo: true,
    isBold: false,
    isItalic: false,
    isUnderline: false,
    alignment: 'left' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all formatting buttons', () => {
    render(<Toolbar {...defaultProps} />);
    expect(screen.getByTitle('실행 취소')).toBeInTheDocument();
    expect(screen.getByTitle('다시 실행')).toBeInTheDocument();
    expect(screen.getByTitle('굵게')).toBeInTheDocument();
    expect(screen.getByTitle('기울임꼴')).toBeInTheDocument();
    expect(screen.getByTitle('밑줄')).toBeInTheDocument();
  });

  it('calls onUndo when undo button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('실행 취소'));
    expect(defaultProps.onUndo).toHaveBeenCalled();
  });

  it('calls onRedo when redo button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('다시 실행'));
    expect(defaultProps.onRedo).toHaveBeenCalled();
  });

  it('disables undo button when canUndo is false', () => {
    render(<Toolbar {...defaultProps} canUndo={false} />);
    expect(screen.getByTitle('실행 취소')).toBeDisabled();
  });

  it('disables redo button when canRedo is false', () => {
    render(<Toolbar {...defaultProps} canRedo={false} />);
    expect(screen.getByTitle('다시 실행')).toBeDisabled();
  });

  it('calls onBold when bold button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('굵게'));
    expect(defaultProps.onBold).toHaveBeenCalled();
  });

  it('shows active state for bold when isBold is true', () => {
    render(<Toolbar {...defaultProps} isBold={true} />);
    const boldButton = screen.getByTitle('굵게');
    expect(boldButton.className).toContain('active');
  });

  it('calls onItalic when italic button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('기울임꼴'));
    expect(defaultProps.onItalic).toHaveBeenCalled();
  });

  it('calls onUnderline when underline button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('밑줄'));
    expect(defaultProps.onUnderline).toHaveBeenCalled();
  });

  it('calls alignment functions when alignment buttons are clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('왼쪽 정렬'));
    expect(defaultProps.onAlignLeft).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('가운데 정렬'));
    expect(defaultProps.onAlignCenter).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('오른쪽 정렬'));
    expect(defaultProps.onAlignRight).toHaveBeenCalled();
  });
});
