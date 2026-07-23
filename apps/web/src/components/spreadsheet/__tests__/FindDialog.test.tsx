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
    fireEvent.click(screen.getAllByRole("button", { name: "찾기" })[1]);

    expect(onFind).toHaveBeenCalledWith("SUM(", true, {
      scope: "workbook",
      mode: "formulas",
    });
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
