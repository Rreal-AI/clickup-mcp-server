// app/api/[transport]/route.ts
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

// Zod schemas for input validation
const getSpacesSchema = {
  archived: z.boolean().optional().describe("Filter for archived spaces"),
};

const getTaskSchema = {
  task_id: z.string().describe("Task ID"),
  custom_task_ids: z
    .boolean()
    .optional()
    .describe(
      "If you want to reference a task by its custom task id, this value must be true"
    ),
  include_subtasks: z
    .boolean()
    .optional()
    .describe("Include subtasks, default false"),
};

const updateTaskSchema = {
  task_id: z.string().describe("Task ID"),
  name: z.string().optional().describe("Task name"),
  description: z.string().optional().describe("Task description"),
  status: z.string().optional().describe("Task status"),
  priority: z
    .number()
    .min(1)
    .max(4)
    .optional()
    .describe("Task priority (1: Urgent, 2: High, 3: Normal, 4: Low)"),
  due_date: z
    .number()
    .optional()
    .describe("Due date in Unix time milliseconds"),
  assignees: z
    .object({
      add: z.array(z.number()).optional(),
      rem: z.array(z.number()).optional(),
    })
    .optional()
    .describe("Object with 'add' and 'rem' arrays of user IDs"),
};

const createTaskSchema = {
  list_id: z.string().describe("List ID"),
  name: z.string().describe("Task name"),
  description: z.string().optional().describe("Task description"),
  status: z.string().optional().describe("Task status"),
  priority: z
    .number()
    .min(1)
    .max(4)
    .optional()
    .describe("Task priority (1: Urgent, 2: High, 3: Normal, 4: Low)"),
  assignees: z
    .array(z.number())
    .optional()
    .describe("Array of user IDs to assign"),
  tags: z.array(z.string()).optional().describe("Array of tag names"),
};

const getWorkspaceTasksSchema = {
  page: z.number().optional().describe("Page to fetch (starts at 0)"),
  order_by: z
    .string()
    .optional()
    .describe("Order by field (e.g., 'created', 'updated', 'due_date')"),
  statuses: z.array(z.string()).optional().describe("Filter by statuses"),
  include_closed: z
    .boolean()
    .optional()
    .describe("Include or exclude closed tasks"),
  assignees: z
    .array(z.number())
    .optional()
    .describe("Filter by assignee user IDs"),
};

const tagTaskSchema = {
  task_id: z.string().describe("Task ID"),
  tag_name: z.string().describe("Tag name"),
};

const attachFileSchema = {
  task_id: z.string().describe("Task ID"),
  file_url: z.string().url().describe("URL of the file to attach"),
  filename: z
    .string()
    .optional()
    .describe(
      "Optional custom filename. If not provided, will be extracted from URL"
    ),
};

const getFoldersSchema = {
  space_id: z.string().describe("Space ID"),
  archived: z.boolean().optional().describe("Filter for archived folders"),
};

const getFolderSchema = {
  folder_id: z.string().describe("Folder ID"),
};

const getListsSchema = {
  folder_id: z.string().describe("Folder ID"),
  archived: z.boolean().optional().describe("Filter for archived lists"),
};

const getFolderlessListsSchema = {
  space_id: z.string().describe("Space ID"),
  archived: z.boolean().optional().describe("Filter for archived lists"),
};

const getListSchema = {
  list_id: z.string().describe("List ID"),
};

const getWorkspaceHierarchySchema = {
  include_archived: z
    .boolean()
    .optional()
    .describe("Include archived items in the hierarchy"),
};

export function handler(req: Request) {
  const url = new URL(req.url);

  const teamId =
    req.headers.get("x-team-id") ||
    url.searchParams.get("teamId") ||
    process.env.CLICKUP_TEAM_ID;
  const apiKey =
    req.headers.get("x-api-key") ||
    url.searchParams.get("apiKey") ||
    process.env.CLICKUP_API_KEY;

  return createMcpHandler(
    (server) => {
      server.tool(
        "get_spaces",
        "Get all spaces in a workspace. View the Spaces available in a Workspace. You can only get member info in private Spaces.",
        getSpacesSchema,
        async ({ archived }) => {
          if (!apiKey) {
            throw new Error("API key is required");
          }

          // Use team_id from parameter or fallback to authInfo
          const workspaceId = teamId;

          if (!workspaceId) {
            throw new Error("team_id is required");
          }

          // Build the URL with optional query parameters
          const url = new URL(
            `https://api.clickup.com/api/v2/team/${workspaceId}/space`
          );
          if (archived !== undefined) {
            url.searchParams.append("archived", String(archived));
          }

          // Make the API request to ClickUp
          const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
              Authorization: apiKey as string,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `ClickUp API error: ${response.status} - ${errorText}`
            );
          }

          const data = await response.json();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  data.spaces.map((space: { id: string; name: string }) => ({
                    id: space.id,
                    name: space.name,
                  })),
                  null,
                  2
                ),
              },
            ],
          };
        }
      );

      // Get Task
      server.tool(
        "get_task",
        "Get a specific task by ID",
        getTaskSchema,
        async ({ task_id, custom_task_ids, include_subtasks }) => {
          if (!apiKey) {
            throw new Error("API key is required");
          }

          const url = new URL(`https://api.clickup.com/api/v2/task/${task_id}`);
          if (custom_task_ids !== undefined) {
            url.searchParams.append("custom_task_ids", String(custom_task_ids));
          }
          if (include_subtasks !== undefined) {
            url.searchParams.append(
              "include_subtasks",
              String(include_subtasks)
            );
          }
          if (custom_task_ids && teamId) {
            url.searchParams.append("team_id", teamId);
          }

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
              Authorization: apiKey as string,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `ClickUp API error: ${response.status} - ${errorText}`
            );
          }

          const data = await response.json();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }
      );

      // Update Task
      server.tool(
        "update_task",
        "Update a task",
        updateTaskSchema,
        async ({
          task_id,
          name,
          description,
          status,
          priority,
          due_date,
          assignees,
        }) => {
          if (!apiKey) {
            throw new Error("API key is required");
          }

          const url = new URL(`https://api.clickup.com/api/v2/task/${task_id}`);

          const body: Record<string, unknown> = {};
          if (name !== undefined) body.name = name;
          if (description !== undefined) body.description = description;
          if (status !== undefined) body.status = status;
          if (priority !== undefined) body.priority = priority;
          if (due_date !== undefined) body.due_date = due_date;
          if (assignees !== undefined) body.assignees = assignees;

          const response = await fetch(url.toString(), {
            method: "PUT",
            headers: {
              Authorization: apiKey as string,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `ClickUp API error: ${response.status} - ${errorText}`
            );
          }

          const data = await response.json();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }
      );

      // Create Task
      server.tool(
        "create_task",
        "Create a new task in a list",
        createTaskSchema,
        async ({
          list_id,
          name,
          description,
          status,
          priority,
          assignees,
          tags,
        }) => {
          if (!apiKey) {
            throw new Error("API key is required");
          }

          const url = new URL(
            `https://api.clickup.com/api/v2/list/${list_id}/task`
          );

          const body: Record<string, unknown> = { name };
          if (description !== undefined) body.description = description;
          if (status !== undefined) body.status = status;
          if (priority !== undefined) body.priority = priority;
          if (assignees !== undefined) body.assignees = assignees;
          if (tags !== undefined) body.tags = tags;

          const response = await fetch(url.toString(), {
            method: "POST",
            headers: {
              Authorization: apiKey as string,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `ClickUp API error: ${response.status} - ${errorText}`
            );
          }

          const data = await response.json();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }
      );

      // Get Workspace Tasks
      server.tool(
        "get_workspace_tasks",
        "Get filtered tasks from a workspace",
        getWorkspaceTasksSchema,
        async ({ page, order_by, statuses, include_closed, assignees }) => {
          if (!apiKey) {
            throw new Error("API key is required");
          }

          const workspaceId = teamId;

          if (!workspaceId) {
            throw new Error("team_id is required");
          }

          const url = new URL(
            `https://api.clickup.com/api/v2/team/${workspaceId}/task`
          );

          if (page !== undefined) url.searchParams.append("page", String(page));
          if (order_by !== undefined)
            url.searchParams.append("order_by", order_by);
          if (include_closed !== undefined)
            url.searchParams.append("include_closed", String(include_closed));
          if (statuses && Array.isArray(statuses)) {
            statuses.forEach((status) =>
              url.searchParams.append("statuses[]", status)
            );
          }
          if (assignees && Array.isArray(assignees)) {
            assignees.forEach((assignee) =>
              url.searchParams.append("assignees[]", String(assignee))
            );
          }

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
              Authorization: apiKey as string,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `ClickUp API error: ${response.status} - ${errorText}`
            );
          }

          const data = await response.json();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }
      );

      // Add Tag to Task
      server.tool(
        "add_tag_to_task",
        "Add a tag to a task",
        tagTaskSchema,
        async ({ task_id, tag_name }) => {
          if (!apiKey) {
            throw new Error("API key is required");
          }

          const url = new URL(
            `https://api.clickup.com/api/v2/task/${task_id}/tag/${encodeURIComponent(
              tag_name
            )}`
          );

          const response = await fetch(url.toString(), {
            method: "POST",
            headers: {
              Authorization: apiKey as string,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `ClickUp API error: ${response.status} - ${errorText}`
            );
          }

          const data = await response.json();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }
      );

      // Remove Tag from Task
      server.tool(
        "remove_tag_from_task",
        "Remove a tag from a task",
        tagTaskSchema,
        async ({ task_id, tag_name }) => {
          if (!apiKey) {
            throw new Error("API key is required");
          }

          const url = new URL(
            `https://api.clickup.com/api/v2/task/${task_id}/tag/${encodeURIComponent(
              tag_name
            )}`
          );

          const response = await fetch(url.toString(), {
            method: "DELETE",
            headers: {
              Authorization: apiKey as string,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `ClickUp API error: ${response.status} - ${errorText}`
            );
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: true }, null, 2),
              },
            ],
          };
        }
      );

      // Attach File to Task
      server.tool(
        "attach_file_to_task",
        "Attach a file to a task by providing a URL. The file will be downloaded and uploaded to ClickUp.",
        attachFileSchema,
        async ({ task_id, file_url, filename }) => {
          if (!apiKey) {
            throw new Error("API key is required");
          }

          try {
            // Fetch the file from the URL
            const fileResponse = await fetch(file_url);
            if (!fileResponse.ok) {
              throw new Error(
                `Failed to fetch file from URL: ${fileResponse.status} - ${fileResponse.statusText}`
              );
            }

            // Get the file data as blob
            const blob = await fileResponse.blob();

            // Extract filename from URL if not provided
            let finalFilename = filename;
            if (!finalFilename) {
              const urlPath = new URL(file_url).pathname;
              finalFilename = urlPath.split("/").pop() || "attachment";
            }

            // Create FormData with the file
            const formData = new FormData();
            formData.append("attachment", blob, finalFilename);

            // Upload to ClickUp
            const url = new URL(
              `https://api.clickup.com/api/v2/task/${task_id}/attachment`
            );

            const response = await fetch(url.toString(), {
              method: "POST",
              headers: {
                Authorization: apiKey as string,
              },
              body: formData,
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(
                `ClickUp API error: ${response.status} - ${errorText}`
              );
            }

            const data = await response.json();

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to attach file: ${errorMessage}`);
          }
        }
      );

      // Get Folders
      server.tool(
        "get_folders",
        "Get all folders in a space",
        getFoldersSchema,
        async ({ space_id, archived }) => {
          if (!apiKey) {
            throw new Error("API key is required");
          }

          const url = new URL(
            `https://api.clickup.com/api/v2/space/${space_id}/folder`
          );

          if (archived !== undefined) {
            url.searchParams.append("archived", String(archived));
          }

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
              Authorization: apiKey as string,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `ClickUp API error: ${response.status} - ${errorText}`
            );
          }

          const data = await response.json();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }
      );

      // Get Folder
      server.tool(
        "get_folder",
        "Get a specific folder by ID",
        getFolderSchema,
        async ({ folder_id }) => {
          if (!apiKey) {
            throw new Error("API key is required");
          }

          const url = new URL(
            `https://api.clickup.com/api/v2/folder/${folder_id}`
          );

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
              Authorization: apiKey as string,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `ClickUp API error: ${response.status} - ${errorText}`
            );
          }

          const data = await response.json();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }
      );

      // Get Lists from Folder
      server.tool(
        "get_lists",
        "Get all lists in a folder",
        getListsSchema,
        async ({ folder_id, archived }) => {
          if (!apiKey) {
            throw new Error("API key is required");
          }

          const url = new URL(
            `https://api.clickup.com/api/v2/folder/${folder_id}/list`
          );

          if (archived !== undefined) {
            url.searchParams.append("archived", String(archived));
          }

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
              Authorization: apiKey as string,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `ClickUp API error: ${response.status} - ${errorText}`
            );
          }

          const data = await response.json();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }
      );

      // Get Folderless Lists
      server.tool(
        "get_folderless_lists",
        "Get all lists without a folder (folderless lists) in a space",
        getFolderlessListsSchema,
        async ({ space_id, archived }) => {
          if (!apiKey) {
            throw new Error("API key is required");
          }

          const url = new URL(
            `https://api.clickup.com/api/v2/space/${space_id}/list`
          );

          if (archived !== undefined) {
            url.searchParams.append("archived", String(archived));
          }

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
              Authorization: apiKey as string,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `ClickUp API error: ${response.status} - ${errorText}`
            );
          }

          const data = await response.json();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }
      );

      // Get List
      server.tool(
        "get_list",
        "Get a specific list by ID",
        getListSchema,
        async ({ list_id }) => {
          if (!apiKey) {
            throw new Error("API key is required");
          }

          const url = new URL(`https://api.clickup.com/api/v2/list/${list_id}`);

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
              Authorization: apiKey as string,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `ClickUp API error: ${response.status} - ${errorText}`
            );
          }

          const data = await response.json();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }
      );

      // Get Workspace Hierarchy
      server.tool(
        "get_workspace_hierarchy",
        "Get the complete hierarchy of a workspace in a tree format (Workspace → Spaces → Folders → Lists). This provides a visual representation of the entire workspace structure.",
        getWorkspaceHierarchySchema,
        async ({ include_archived }) => {
          if (!apiKey) {
            throw new Error("API key is required");
          }

          const workspaceId = teamId;

          if (!workspaceId) {
            throw new Error("team_id is required");
          }

          try {
            let hierarchyText = `Workspace (Team ID: ${workspaceId})\n`;

            // Get all spaces
            const spacesUrl = new URL(
              `https://api.clickup.com/api/v2/team/${workspaceId}/space`
            );
            if (include_archived) {
              spacesUrl.searchParams.append("archived", "true");
            }

            const spacesResponse = await fetch(spacesUrl.toString(), {
              method: "GET",
              headers: {
                Authorization: apiKey as string,
                "Content-Type": "application/json",
              },
            });

            if (!spacesResponse.ok) {
              throw new Error(
                `Failed to fetch spaces: ${spacesResponse.status}`
              );
            }

            const spacesData = await spacesResponse.json();
            const spaces = spacesData.spaces || [];

            for (let i = 0; i < spaces.length; i++) {
              const space = spaces[i];
              const isLastSpace = i === spaces.length - 1;
              const spacePrefix = isLastSpace ? "└──" : "├──";
              const childPrefix = isLastSpace ? "    " : "│   ";

              hierarchyText += `${spacePrefix} Space: ${space.name} (ID: ${space.id})\n`;

              // Get folders in this space
              const foldersUrl = new URL(
                `https://api.clickup.com/api/v2/space/${space.id}/folder`
              );
              if (include_archived) {
                foldersUrl.searchParams.append("archived", "true");
              }

              const foldersResponse = await fetch(foldersUrl.toString(), {
                method: "GET",
                headers: {
                  Authorization: apiKey as string,
                  "Content-Type": "application/json",
                },
              });

              const folders = foldersResponse.ok
                ? (await foldersResponse.json()).folders || []
                : [];

              // Get folderless lists
              const folderlessListsUrl = new URL(
                `https://api.clickup.com/api/v2/space/${space.id}/list`
              );
              if (include_archived) {
                folderlessListsUrl.searchParams.append("archived", "true");
              }

              const folderlessListsResponse = await fetch(
                folderlessListsUrl.toString(),
                {
                  method: "GET",
                  headers: {
                    Authorization: apiKey as string,
                    "Content-Type": "application/json",
                  },
                }
              );

              const folderlessLists = folderlessListsResponse.ok
                ? (await folderlessListsResponse.json()).lists || []
                : [];

              // Process folders
              for (let j = 0; j < folders.length; j++) {
                const folder = folders[j];
                const isLastItem =
                  j === folders.length - 1 && folderlessLists.length === 0;
                const folderPrefix = isLastItem ? "└──" : "├──";
                const folderChildPrefix = isLastItem ? "    " : "│   ";

                hierarchyText += `${childPrefix}${folderPrefix} Folder: ${folder.name} (ID: ${folder.id})\n`;

                // Get lists in this folder
                const listsUrl = new URL(
                  `https://api.clickup.com/api/v2/folder/${folder.id}/list`
                );
                if (include_archived) {
                  listsUrl.searchParams.append("archived", "true");
                }

                const listsResponse = await fetch(listsUrl.toString(), {
                  method: "GET",
                  headers: {
                    Authorization: apiKey as string,
                    "Content-Type": "application/json",
                  },
                });

                const lists = listsResponse.ok
                  ? (await listsResponse.json()).lists || []
                  : [];

                for (let k = 0; k < lists.length; k++) {
                  const list = lists[k];
                  const isLastList = k === lists.length - 1;
                  const listPrefix = isLastList ? "└──" : "├──";

                  hierarchyText += `${childPrefix}${folderChildPrefix}${listPrefix} List: ${list.name} (ID: ${list.id})\n`;
                }
              }

              // Process folderless lists
              for (let j = 0; j < folderlessLists.length; j++) {
                const list = folderlessLists[j];
                const isLastList = j === folderlessLists.length - 1;
                const listPrefix = isLastList ? "└──" : "├──";

                hierarchyText += `${childPrefix}${listPrefix} List (Folderless): ${list.name} (ID: ${list.id})\n`;
              }
            }

            return {
              content: [
                {
                  type: "text",
                  text: hierarchyText,
                },
              ],
            };
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to build hierarchy: ${errorMessage}`);
          }
        }
      );
    },
    {},
    {
      basePath: "/api", // this needs to match where the [transport] is located.
      maxDuration: 60,
    }
  )(req);
}

// // Wrap your handler with authorization
// const verifyToken = async (
//   req: Request,
//   bearerToken?: string
// ): Promise<AuthInfo | undefined> => {
//   const url = new URL(req.url);

//   const teamId =
//     req.headers.get("x-team-id") ||
//     url.searchParams.get("teamId") ||
//     process.env.CLICKUP_TEAM_ID;
//   const apiKey =
//     req.headers.get("x-api-key") ||
//     url.searchParams.get("apiKey") ||
//     process.env.CLICKUP_API_KEY;

//   return {
//     clientId: "mcp-clickup",
//     scopes: [],
//     token: apiKey as string,
//     extra: { teamId, apiKey },
//   };
// };

// // Make authorization required
// const authHandler = withMcpAuth(handler, verifyToken, {
//   required: true, // Make auth required for all requests
// });

export { handler as GET, handler as POST };
