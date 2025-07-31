import React, { useState } from "react";
import "../admin/roleManagement.css";
import Sidebar from "../sidebar";
import { FaChevronDown, FaBell, FaEdit, FaArchive, FaPlus, FaFolderOpen } from "react-icons/fa";
import DataTable from "react-data-table-component";

function RoleManagement() {
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [showAddRoleModal, setShowAddRoleModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewedRole, setViewedRole] = useState(null);

    const permissionGroups = [
        { title: "Administration", options: ["View Dashboard", "View Audit Logs", "Manage Roles", "Manage Users"] },
        { title: "Sales & Orders", options: ["Process Sales", "Manage Orders", "Issue Refunds", "View Sales Reports"] },
        { title: "Product Management", options: ["View Products", "Add New Products", "Manage Categories", "Modify Products"] },
        { title: "Promotions", options: ["View Promotions", "Manage Discounts", "Create Coupons", "Apply Discounts"] },
        { title: "Reports", options: ["View Basic Reports", "Financial Reports", "Export Reports", "View Employee Reports", "View Sales Reports", "Inventory Reports"] },
    ];

    const [roles, setRoles] = useState([
        {
            id: 1,
            name: "Admin",
            description: "Full system access with all permissions",
            users: 1,
            updated: "Apr 20, 2025",
            permissions: ["View Dashboard", "Manage Roles", "Manage Users", "View Sales Reports", "Financial Reports"],
        },
        {
            id: 2,
            name: "Manager",
            description: "Store management with limited admin access",
            users: 3,
            updated: "Apr 20, 2025",
            permissions: ["Process Sales", "Manage Orders", "View Products"],
        },
        {
            id: 3,
            name: "Cashier",
            description: "Point of sale and basic inventory functions",
            users: 5,
            updated: "Apr 20, 2025",
            permissions: ["Process Sales", "Issue Refunds", "View Products"],
        },
    ]);

    const userRole = "Admin";
    const userName = "Lim Alcovendas";

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        permissions: [],
    });

    const toggleDropdown = () => setDropdownOpen(!isDropdownOpen);

    const currentDate = new Date().toLocaleString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        hour: "numeric", minute: "numeric", second: "numeric",
    });

    const openAddRoleModal = () => {
        setFormData({ name: "", description: "", permissions: [] });
        setSelectedRole(null);
        setIsEditing(false);
        setShowAddRoleModal(true);
    };

    const handleEditRole = (role) => {
        setFormData({ name: role.name, description: role.description, permissions: role.permissions || [] });
        setSelectedRole(role);
        setIsEditing(true);
        setShowAddRoleModal(true);
    };

    const closeAddRoleModal = () => {
        setShowAddRoleModal(false);
        setSelectedRole(null);
        setIsEditing(false);
    };

    const handleViewRole = (role) => {
        setViewedRole(role);
        setShowViewModal(true);
    };

    const handleDeleteRole = (roleId) => {
        const confirmDelete = window.confirm("Are you sure you want to delete this role?");
        if (confirmDelete) {
            setRoles((prev) => prev.filter((role) => role.id !== roleId));
        }
    };    

    const closeViewModal = () => {
        setViewedRole(null);
        setShowViewModal(false);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (perm) => {
        setFormData((prev) => {
            const isChecked = prev.permissions.includes(perm);
            const newPermissions = isChecked
                ? prev.permissions.filter((p) => p !== perm)
                : [...prev.permissions, perm];
            return { ...prev, permissions: newPermissions };
        });
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();

        const updatedDate = new Date().toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
        });

        if (isEditing && selectedRole) {
            setRoles((prev) =>
                prev.map((role) =>
                    role.id === selectedRole.id
                        ? {
                              ...role,
                              name: formData.name,
                              description: formData.description,
                              permissions: formData.permissions,
                              updated: updatedDate,
                          }
                        : role
                )
            );
        } else {
            const newRole = {
                id: roles.length + 1,
                name: formData.name,
                description: formData.description,
                users: 0,
                updated: updatedDate,
                permissions: formData.permissions,
            };
            setRoles((prev) => [...prev, newRole]);
        }

        closeAddRoleModal();
    };

    const columns = [
        { name: "ROLE NAME", selector: (row) => row.name, sortable: true, width: "15%" },
        { name: "DESCRIPTION", selector: (row) => row.description, wrap: true, width: "23%" },
        { name: "USERS", selector: (row) => row.users, center: true, width: "22%" },
        { name: "LAST UPDATED", selector: (row) => row.updated, width: "20%" },
        {
            name: "ACTION",
            cell: (row) => (
                <div className="action-buttons">
                    <button className="view-button" onClick={() => handleViewRole(row)}><FaFolderOpen /></button>
                    <button className="edit-button" onClick={() => handleEditRole(row)}><FaEdit /></button>
                    <button className="delete-button" onClick={() => handleDeleteRole(row.id)}><FaArchive /></button>
                </div>
            ),
            ignoreRowClick: true,
            allowOverflow: true,
            button: true,
            width: "20%",
        },
    ];

    return (
        <div className="roleManagement">
            <Sidebar />
            <div className="roles">
                <header className="header">
                    <div className="header-left">
                        <h2 className="page-title">Role Management</h2>
                    </div>
                    <div className="header-right">
                        <div className="header-date">{currentDate}</div>
                        <div className="header-profile">
                            <div className="profile-pic"></div>
                            <div className="profile-info">
                                <div className="profile-role">Hi! I'm {userRole}</div>
                                <div className="profile-name">{userName}</div>
                            </div>
                            <div className="dropdown-icon" onClick={toggleDropdown}><FaChevronDown /></div>
                            <div className="bell-icon"><FaBell className="bell-outline" /></div>
                            {isDropdownOpen && (
                                <div className="profile-dropdown">
                                    <ul><li>Edit Profile</li><li>Logout</li></ul>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="roleManagement-content">
                    <div className="table-header">
                        <button className="add-role-btn" onClick={openAddRoleModal}><FaPlus /> Add Role</button>
                    </div>

                    {/* Add/Edit Modal */}
                    {showAddRoleModal && (
                        <div className="modal-role-overlay">
                            <div className="modal-role-border">
                                <div className="modal-role-header">
                                    <h2>{isEditing ? "Edit Role" : "Add New Role"}</h2>
                                    <button className="modal-role-close" onClick={closeAddRoleModal}>×</button>
                                </div>
                                <div className="modal-role-container">
                                    <div className="modal-role-body">
                                        <form className="modal-form" onSubmit={handleFormSubmit}>
                                            <div className="form-group">
                                                <label>Role Name<span className="required">*</span></label>
                                                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                                            </div>
                                            <div className="form-group">
                                                <label>Description<span className="required">*</span></label>
                                                <textarea name="description" value={formData.description} onChange={handleInputChange} required />
                                            </div>
                                            <div className="form-group">
                                                <label>Permissions<span className="required">*</span></label>
                                                <div className="permissions-grid">
                                                    {permissionGroups.map((group, index) => (
                                                        <div className="permission-group" key={index}>
                                                            <h4>{group.title}</h4>
                                                            <div className="permission-options-grid">
                                                                {group.options.map((perm, idx) => (
                                                                    <label key={idx}>
                                                                        <input type="checkbox" checked={formData.permissions.includes(perm)} onChange={() => handleCheckboxChange(perm)} /> {perm}
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <button type="submit" className="save-role-btn">{isEditing ? "Update Role" : "Save Role"}</button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* View Modal */}
                    {showViewModal && viewedRole && (
                        <div className="modal-role-overlay">
                            <div className="modal-role-border">
                                <div className="modal-role-header">
                                    <h2>Role Details</h2>
                                    <button className="modal-role-close" onClick={closeViewModal}>×</button>
                                </div>
                                <div className="modal-role-container">
                                    <div className="modal-role-body">
                                        <form className="modal-form">
                                            <div className="form-group">
                                                <label>Role Name</label>
                                                <input type="text" value={viewedRole.name} disabled />
                                            </div>
                                            <div className="form-group">
                                                <label>Description</label>
                                                <textarea value={viewedRole.description} disabled />
                                            </div>
                                            <div className="form-group">
                                                <label>Permissions</label>
                                                <div className="permissions-grid">
                                                    {permissionGroups.map((group, index) => (
                                                        <div className="permission-group" key={index}>
                                                            <h4>{group.title}</h4>
                                                            <div className="permission-options-grid">
                                                                {group.options.map((perm, idx) => (
                                                                    <label key={idx}>
                                                                        <input type="checkbox" checked={viewedRole.permissions.includes(perm)} readOnly disabled /> {perm}
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DataTable
                        columns={columns}
                        data={roles}
                        striped
                        highlightOnHover
                        responsive
                        pagination
                        customStyles={{
                            headCells: {
                                style: {
                                    backgroundColor: "#4B929D",
                                    color: "#fff",
                                    fontWeight: "600",
                                    fontSize: "14px",
                                    padding: "12px",
                                    textTransform: "uppercase",
                                    textAlign: "center",
                                    letterSpacing: "1px",
                                },
                            },
                            rows: {
                                style: {
                                    minHeight: "55px",
                                    padding: "5px",
                                },
                            },
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

export default RoleManagement;
