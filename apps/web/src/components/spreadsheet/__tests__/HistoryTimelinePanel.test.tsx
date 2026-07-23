import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError, apiClient } from "@/lib/api-client";
import HistoryTimelinePanel from "../HistoryTimelinePanel";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return {
    ...actual,
    apiClient: { request: jest.fn() },
  };
});

const request = jest.mocked(apiClient.request);
const revisionPage = {
  revisions: [
    {
      id: "revision-1",
      action: "CELL_UPDATE",
      targetRange: "A1",
      description: "Updated 1 cell(s)",
      previousData: [{ row: 0, col: 0, value: "before" }],
      createdAt: "2026-07-23T01:00:00.000Z",
      user: {
        id: "user-1",
        name: "Owner",
        email: "owner@example.com",
      },
    },
  ],
};

function mockReads() {
  request.mockImplementation(async (path, options) => {
    if (options?.method === "POST") return { version: 9 };
    if (path.endsWith("/stats")) {
      return { totalRevisions: 1, revisionsByAction: [], activityByDay: {} };
    }
    return revisionPage;
  });
}

describe("HistoryTimelinePanel rollback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReads();
    jest.spyOn(window, "confirm").mockReturnValue(true);
    jest.spyOn(window, "alert").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("flushes pending saves, sends the latest version, and reloads after restore", async () => {
    const beforeRollback = jest.fn().mockResolvedValue(8);
    const onRollback = jest.fn().mockResolvedValue(undefined);
    render(
      <HistoryTimelinePanel
        isOpen
        sheetId="sheet-1"
        currentVersion={7}
        onClose={jest.fn()}
        beforeRollback={beforeRollback}
        onRollback={onRollback}
      />,
    );

    fireEvent.click(await screen.findByText("Updated 1 cell(s)"));
    fireEvent.click(screen.getByRole("button", { name: "이 변경 되돌리기" }));

    await waitFor(() =>
      expect(onRollback).toHaveBeenCalledWith("revision-1", 9),
    );
    const postCall = request.mock.calls.find(
      ([, options]) => options?.method === "POST",
    );
    expect(postCall?.[0]).toBe("/sheets/sheet-1/revisions/revision-1/rollback");
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      expectedVersion: 8,
      idempotencyKey: expect.stringMatching(/^rollback-[0-9a-f-]+$/),
    });
    expect(beforeRollback.mock.invocationCallOrder[0]).toBeLessThan(
      request.mock.invocationCallOrder[2],
    );
    expect(
      request.mock.calls.filter(([path]) => path.endsWith("/stats")),
    ).toHaveLength(2);
    expect(window.alert).toHaveBeenCalledWith("선택한 변경을 복원했습니다.");
  });

  it("shows a server conflict without reloading the sheet", async () => {
    request.mockImplementation(async (path, options) => {
      if (options?.method === "POST") {
        throw new ApiError(
          "Some target cells changed",
          409,
          null,
          String(path),
        );
      }
      if (path.endsWith("/stats")) {
        return { totalRevisions: 1, revisionsByAction: [], activityByDay: {} };
      }
      return revisionPage;
    });
    const onRollback = jest.fn();
    render(
      <HistoryTimelinePanel
        isOpen
        sheetId="sheet-1"
        currentVersion={8}
        onClose={jest.fn()}
        onRollback={onRollback}
      />,
    );

    fireEvent.click(await screen.findByText("Updated 1 cell(s)"));
    fireEvent.click(screen.getByRole("button", { name: "이 변경 되돌리기" }));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(
        "복원에 실패했습니다: Some target cells changed",
      ),
    );
    expect(onRollback).not.toHaveBeenCalled();
  });
});
