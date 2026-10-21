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

/** Sidebar navigation per role. `labelKey` is an i18n key; `end` = only active on an exact path match. */
export const NAVIGATION = {
  student: [
    { to: "/student/dashboard", labelKey: "nav.dashboard", icon: FaHome },
    { to: "/student/analytics", labelKey: "nav.results", icon: FaChartBar },
  ],
  instructor: [
    { to: "/instructor/dashboard", labelKey: "nav.dashboard", icon: FaHome },
    { to: "/instructor/assessments", labelKey: "nav.assessments", icon: FaClipboardList, end: true },
    { to: "/instructor/assessments/create", labelKey: "nav.newAssessment", icon: FaPlusCircle },
    { to: "/instructor/resources", labelKey: "nav.resources", icon: FaFolderOpen },
    { to: "/instructor/students", labelKey: "nav.registerStudent", icon: FaUserPlus },
  ],
  admin: [{ to: "/admin/dashboard", labelKey: "nav.users", icon: FaUsers }],
  super_admin: [{ to: "/super-admin/dashboard", labelKey: "nav.users", icon: FaUsers }],
};

export const ACCOUNT_LINKS = [{ to: "/profile", labelKey: "nav.profile", icon: FaUserCog }];

// The product name is a proper noun and is never translated.
export const BRAND = { name: "Gradix", icon: FaBook };
