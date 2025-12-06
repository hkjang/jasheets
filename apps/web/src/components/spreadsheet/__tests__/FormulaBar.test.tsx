import { render, screen, fireEvent } from '@testing-library/react';
import FormulaBar from '../FormulaBar';

describe('FormulaBar', () => {
  const defaultProps = {
    selectedCell: { row: 0, col: 0 },
    value: 'Hello',
    formula: null,
    isEditing: false,
    onValueChange: jest.fn(),
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
    onEdit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders cell reference correctly', () => {
    render(<FormulaBar {...defaultProps} />);
    expect(screen.getByText('A1')).toBeInTheDocument();
  });

  it('displays cell value when not editing', () => {
    render(<FormulaBar {...defaultProps} />);
    expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
  });

  it('displays formula when available', () => {
    render(<FormulaBar {...defaultProps} formula="=SUM(A1:A10)" value="55" />);
    expect(screen.getByDisplayValue('=SUM(A1:A10)')).toBeInTheDocument();
  });

  it('calls onEdit when clicking on input', () => {
    render(<FormulaBar {...defaultProps} />);
    const input = screen.getByDisplayValue('Hello');
    fireEvent.click(input);
    expect(defaultProps.onEdit).toHaveBeenCalled();
  });

  it('calls onValueChange when typing', () => {
    render(<FormulaBar {...defaultProps} isEditing={true} />);
    const input = screen.getByDisplayValue('Hello');
    fireEvent.change(input, { target: { value: 'World' } });
    expect(defaultProps.onValueChange).toHaveBeenCalledWith('World');
  });

  it('calls onSubmit when pressing Enter', () => {
    render(<FormulaBar {...defaultProps} isEditing={true} />);
    const input = screen.getByDisplayValue('Hello');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onSubmit).toHaveBeenCalled();
  });

  it('calls onCancel when pressing Escape', () => {
    render(<FormulaBar {...defaultProps} isEditing={true} />);
    const input = screen.getByDisplayValue('Hello');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('shows column letter for different columns', () => {
    render(<FormulaBar {...defaultProps} selectedCell={{ row: 5, col: 2 }} />);
    expect(screen.getByText('C6')).toBeInTheDocument();
  });

  it('handles null selectedCell', () => {
    render(<FormulaBar {...defaultProps} selectedCell={null} />);
    expect(screen.queryByText('A1')).not.toBeInTheDocument();
  });
});
