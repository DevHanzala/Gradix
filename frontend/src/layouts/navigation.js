import {
  FaBook,
  FaChartBar,
  FaClipboardList,
  FaFolderOpen,
  FaHome,
  FaPlusCircle,
  FaUserCog,
  FaUserPlus,
  FaUsers,
} from "react-icons/fa";

/** Sidebar navigation per role. `end` = only active on an exact path match. */
export const NAVIGATION = {
  student: [
    { to: "/student/dashboard", label: "Dashboard", icon: FaHome },
    { to: "/student/analytics", label: "Results & review", icon: FaChartBar },
  ],
  instructor: [
    { to: "/instructor/dashboard", label: "Dashboard", icon: FaHome },
    { to: "/instructor/assessments", label: "Assessments", icon: FaClipboardList, end: true },
    { to: "/instructor/assessments/create", label: "New assessment", icon: FaPlusCircle },
    { to: "/instructor/resources", label: "Resources", icon: FaFolderOpen },
    { to: "/instructor/students", label: "Register student", icon: FaUserPlus },
  ],
  admin: [{ to: "/admin/dashboard", label: "Users", icon: FaUsers }],
  super_admin: [{ to: "/super-admin/dashboard", label: "Users", icon: FaUsers }],
};

export const ACCOUNT_LINKS = [{ to: "/profile", label: "My profile", icon: FaUserCog }];

export const BRAND = { name: "Gradix", icon: FaBook };
