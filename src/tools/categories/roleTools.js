// src/tools/categories/roleTools.js
/**
 * Discord Role Management Tools
 * 
 * Tools for creating, modifying, assigning, and managing roles.
 * Includes role permissions, hierarchy management, and advanced role operations.
 * 
 * @module roleTools
 */

/**
 * Get all Discord role management tools
 * @param {Guild} guild - Discord guild object for context
 * @returns {Array} Array of role tool definitions
 */
function getRoleTools(guild) {
    return [
        // ===== ROLE MANAGEMENT TOOLS =====
        {
            name: "create_role",
            description: "Create a new role in the server. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    roleName: {
                        type: "string",
                        description: "Name for the new role"
                    },
                    color: {
                        type: "string",
                        description: "Hex color code for the role (e.g., #FF6B35)"
                    },
                    hoist: {
                        type: "boolean",
                        description: "Display role members separately in the member list"
                    }
                },
                required: ["roleName"]
            }
        },
        {
            name: "delete_role",
            description: "Delete a role from the server. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    roleName: {
                        type: "string",
                        description: "Name of the role to delete"
                    }
                },
                required: ["roleName"]
            }
        },
        {
            name: "rename_role",
            description: "Rename an existing role. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    oldName: {
                        type: "string",
                        description: "Current name of the role"
                    },
                    newName: {
                        type: "string",
                        description: "New name for the role"
                    }
                },
                required: ["oldName", "newName"]
            }
        },
        {
            name: "set_role_color",
            description: "Change the color of a role. Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    roleName: {
                        type: "string",
                        description: "Name of the role"
                    },
                    color: {
                        type: "string",
                        description: "Hex color code (e.g., #FF6B35)"
                    }
                },
                required: ["roleName", "color"]
            }
        },
        {
            name: "assign_role",
            description: "Assign a role to a member. Anyone can request self-assignable roles for themselves. Owner can assign any role to anyone.",
            input_schema: {
                type: "object",
                properties: {
                    roleName: {
                        type: "string",
                        description: "Name of the role to assign"
                    },
                    userId: {
                        type: "string",
                        description: "Optional: Discord user ID. If not provided, assigns to the current user."
                    }
                },
                required: ["roleName"]
            }
        },
        {
            name: "remove_role",
            description: "Remove a role from a member. Anyone can remove their own self-assignable roles.",
            input_schema: {
                type: "object",
                properties: {
                    roleName: {
                        type: "string",
                        description: "Name of the role to remove"
                    },
                    userId: {
                        type: "string",
                        description: "Optional: Discord user ID. If not provided, removes from current user."
                    }
                },
                required: ["roleName"]
            }
        },

        // ===== ROLE PERMISSIONS TOOLS =====
        {
            name: "set_role_permissions",
            description: "Set permissions for a role (Admin, Moderator, etc.). Requires owner permissions.",
            input_schema: {
                type: "object",
                properties: {
                    roleName: {
                        type: "string",
                        description: "Role to modify"
                    },
                    permissions: {
                        type: "string",
                        description: "Permission bit value or comma-separated permission names"
                    }
                },
                required: ["roleName", "permissions"]
            }
        },

        // ===== ROLE MANAGEMENT TOOLS (ADVANCED) =====
        {
            name: "get_role_info",
            description: "Get detailed information about a role including permissions, member count, color, position, and whether it's managed or hoisted.",
            input_schema: {
                type: "object",
                properties: {
                    roleId: {
                        type: "string",
                        description: "Role ID to get information about"
                    }
                },
                required: ["roleId"]
            }
        },
        {
            name: "get_role_members",
            description: "Get all members who have a specific role with detailed information about each member.",
            input_schema: {
                type: "object",
                properties: {
                    roleId: {
                        type: "string",
                        description: "Role ID to get members for"
                    }
                },
                required: ["roleId"]
            }
        },
        {
            name: "update_role_permissions",
            description: "Update permissions for a role. Cannot modify managed roles or roles higher than Sunny's highest role. Requires Manage Roles permission.",
            input_schema: {
                type: "object",
                properties: {
                    roleId: {
                        type: "string",
                        description: "Role ID to update"
                    },
                    permissions: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        description: "Array of permission names (e.g., ['ViewChannels', 'SendMessages', 'ModerateMembers'])"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for update (default: 'Updated by Sunny')"
                    }
                },
                required: ["roleId", "permissions"]
            }
        },
        {
            name: "reorder_roles",
            description: "Change a role's position in the role hierarchy. Cannot move roles higher than Sunny's highest role. Requires Manage Roles permission.",
            input_schema: {
                type: "object",
                properties: {
                    roleId: {
                        type: "string",
                        description: "Role ID to reorder"
                    },
                    newPosition: {
                        type: "number",
                        description: "New position in the hierarchy (0 = bottom)"
                    },
                    reason: {
                        type: "string",
                        description: "Reason for reordering (default: 'Role reordered by Sunny')"
                    }
                },
                required: ["roleId", "newPosition"]
            }
        }
    ];
}

module.exports = { getRoleTools };
