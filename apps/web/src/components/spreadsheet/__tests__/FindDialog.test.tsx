import { fireEvent, render, screen } from "@testing-library/react";
import FindDialog from "../FindDialog";

describe("FindDialog", () => {
  it("forwards workbook, formula, and case-sensitive search options", () => {
    const onFind = jest.fn();
    render(
      <FindDialog
        isOpen
        onClose={jest.fn()}
        onFind={onFind}
        onReplace={jest.fn()}
        onReplaceAll={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("찾을 내용"), {
      target: { value: "SUM(" },
    });
    fireEvent.change(screen.getByLabelText("검색 범위"), {
      target: { value: "workbook" },
    });
    fireEvent.change(screen.getByLabelText("검색 대상"), {
      target: { value: "formulas" },
    });
    fireEvent.click(screen.getByLabelText("대소문자 구분"));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    expect(onFind).toHaveBeenCalledWith("SUM(", true, {
      scope: "workbook",
      mode: "formulas",
      direction: "next",
    });
  });

  it("supports Enter, Shift+Enter, and Escape keyboard navigation", () => {
    const onFind = jest.fn();
    const onClose = jest.fn();
    render(
      <FindDialog
        isOpen
        onClose={onClose}
        onFind={onFind}
        onReplace={jest.fn()}
        onReplaceAll={jest.fn()}
      />,
    );
    const input = screen.getByLabelText("찾을 내용");
    fireEvent.change(input, { target: { value: "total" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onFind).toHaveBeenNthCalledWith(1, "total", false, {
      scope: "sheet",
      mode: "values",
      direction: "next",
    });
    expect(onFind).toHaveBeenNthCalledWith(2, "total", false, {
      scope: "sheet",
      mode: "values",
      direction: "previous",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render while closed", () => {
    const { container } = render(
      <FindDialog
        isOpen={false}
        onClose={jest.fn()}
        onFind={jest.fn()}
        onReplace={jest.fn()}
        onReplaceAll={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
