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
    expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeInTheDocument();
    expect(screen.getByTitle('Redo (Ctrl+Y)')).toBeInTheDocument();
    expect(screen.getByTitle('Bold (Ctrl+B)')).toBeInTheDocument();
    expect(screen.getByTitle('Italic (Ctrl+I)')).toBeInTheDocument();
    expect(screen.getByTitle('Underline (Ctrl+U)')).toBeInTheDocument();
  });

  it('calls onUndo when undo button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Undo (Ctrl+Z)'));
    expect(defaultProps.onUndo).toHaveBeenCalled();
  });

  it('calls onRedo when redo button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Redo (Ctrl+Y)'));
    expect(defaultProps.onRedo).toHaveBeenCalled();
  });

  it('disables undo button when canUndo is false', () => {
    render(<Toolbar {...defaultProps} canUndo={false} />);
    expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeDisabled();
  });

  it('disables redo button when canRedo is false', () => {
    render(<Toolbar {...defaultProps} canRedo={false} />);
    expect(screen.getByTitle('Redo (Ctrl+Y)')).toBeDisabled();
  });

  it('calls onBold when bold button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Bold (Ctrl+B)'));
    expect(defaultProps.onBold).toHaveBeenCalled();
  });

  it('shows active state for bold when isBold is true', () => {
    render(<Toolbar {...defaultProps} isBold={true} />);
    const boldButton = screen.getByTitle('Bold (Ctrl+B)');
    expect(boldButton.className).toContain('active');
  });

  it('calls onItalic when italic button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Italic (Ctrl+I)'));
    expect(defaultProps.onItalic).toHaveBeenCalled();
  });

  it('calls onUnderline when underline button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Underline (Ctrl+U)'));
    expect(defaultProps.onUnderline).toHaveBeenCalled();
  });

  it('calls alignment functions when alignment buttons are clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Align left'));
    expect(defaultProps.onAlignLeft).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Align center'));
    expect(defaultProps.onAlignCenter).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Align right'));
    expect(defaultProps.onAlignRight).toHaveBeenCalled();
  });
});
