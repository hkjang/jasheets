import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SheetTabs from "../SheetTabs";

describe("SheetTabs", () => {
  const sheets = [
    { id: "sheet-1", name: "Sheet 1" },
    { id: "sheet-2", name: "Forecast" },
  ];

  it("selects, adds, renames, and deletes sheets", async () => {
    const onSelect = jest.fn();
    const onAdd = jest.fn();
    const onRename = jest.fn();
    const onDelete = jest.fn();
    const onReorder = jest.fn();
    const onDuplicate = jest.fn();

    render(
      <SheetTabs
        sheets={sheets}
        activeSheetId="sheet-1"
        onSelect={onSelect}
        onAdd={onAdd}
        onRename={onRename}
        onDelete={onDelete}
        onReorder={onReorder}
        onDuplicate={onDuplicate}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Forecast" }));
    expect(onSelect).toHaveBeenCalledWith("sheet-2");

    fireEvent.click(screen.getByRole("button", { name: "새 시트 추가" }));
    expect(onAdd).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Sheet 1 복제" }));
    expect(onDuplicate).toHaveBeenCalledWith("sheet-1");

    fireEvent.doubleClick(screen.getByRole("tab", { name: "Sheet 1" }));
    const input = screen.getByRole("textbox", { name: "시트 이름" });
    fireEvent.change(input, { target: { value: "  Revenue  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(onRename).toHaveBeenCalledWith("sheet-1", "Revenue"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Sheet 1 삭제" }));
    expect(onDelete).toHaveBeenCalledWith("sheet-1");
  });

  it("uses arrow keys to move between tabs", () => {
    const onSelect = jest.fn();
    render(
      <SheetTabs
        sheets={sheets}
        activeSheetId="sheet-1"
        onSelect={onSelect}
        onAdd={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
        onReorder={jest.fn()}
        onDuplicate={jest.fn()}
      />,
    );

    fireEvent.keyDown(screen.getByRole("tab", { name: "Sheet 1" }), {
      key: "ArrowLeft",
    });
    expect(onSelect).toHaveBeenCalledWith("sheet-2");
  });

  it("reorders tabs by drag and accessible keyboard shortcut", () => {
    const onReorder = jest.fn();
    render(
      <SheetTabs
        sheets={sheets}
        activeSheetId="sheet-1"
        onSelect={jest.fn()}
        onAdd={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
        onReorder={onReorder}
        onDuplicate={jest.fn()}
      />,
    );

    const source = screen.getByRole("tab", { name: "Sheet 1" }).parentElement!;
    const target = screen.getByRole("tab", { name: "Forecast" }).parentElement!;
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: jest.fn(),
      getData: jest.fn(() => "sheet-1"),
    };
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(onReorder).toHaveBeenCalledWith("sheet-1", 1);

    fireEvent.keyDown(screen.getByRole("tab", { name: "Sheet 1" }), {
      key: "ArrowRight",
      altKey: true,
      shiftKey: true,
    });
    expect(onReorder).toHaveBeenLastCalledWith("sheet-1", 1);
  });
});
