import {
  FaUniversity,
  FaChalkboardTeacher,
  FaBook,
  FaCalendarAlt,
  FaClock,
  FaStickyNote,
} from "react-icons/fa";
import { getTranslation } from "../utils/translations";

const PaperFormFields = ({ form, onChange, language = "en" }) => {
  const t = (key) => getTranslation(language, key);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Institute Name */}
      <div className="group">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t("instituteName")}
        </label>
        <div className="flex items-center gap-3 sm:gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-3 sm:p-4 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-all duration-200 focus-within:border-blue-500 focus-within:shadow-lg">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <FaUniversity className="text-lg sm:text-xl" />
          </div>
          <input
            type="text"
            name="instituteName"
            placeholder={t("instituteNamePlaceholder")}
            value={form.instituteName}
            onChange={onChange}
            className="w-full bg-transparent outline-none text-sm sm:text-base placeholder-gray-400 font-medium"
          />
        </div>
      </div>

      {/* Teacher Name */}
      <div className="group">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t("teacherName")}
        </label>
        <div className="flex items-center gap-3 sm:gap-4 bg-gradient-to-r from-green-50 to-emerald-50 p-3 sm:p-4 rounded-xl border-2 border-green-200 hover:border-green-400 transition-all duration-200 focus-within:border-green-500 focus-within:shadow-lg">
          <div className="bg-green-600 text-white p-2 rounded-lg">
            <FaChalkboardTeacher className="text-lg sm:text-xl" />
          </div>
          <input
            type="text"
            name="teacherName"
            placeholder={t("teacherNamePlaceholder")}
            value={form.teacherName}
            onChange={onChange}
            className="w-full bg-transparent outline-none text-sm sm:text-base placeholder-gray-400 font-medium"
          />
        </div>
      </div>

      {/* Subject Name */}
      <div className="group">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t("subjectName")}
        </label>
        <div className="flex items-center gap-3 sm:gap-4 bg-gradient-to-r from-purple-50 to-pink-50 p-3 sm:p-4 rounded-xl border-2 border-purple-200 hover:border-purple-400 transition-all duration-200 focus-within:border-purple-500 focus-within:shadow-lg">
          <div className="bg-purple-600 text-white p-2 rounded-lg">
            <FaBook className="text-lg sm:text-xl" />
          </div>
          <input
            type="text"
            name="subjectName"
            placeholder={t("subjectNamePlaceholder")}
            value={form.subjectName}
            onChange={onChange}
            className="w-full bg-transparent outline-none text-sm sm:text-base placeholder-gray-400 font-medium"
          />
        </div>
      </div>

      {/* Date and Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="group">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t("paperDate")}
          </label>
          <div className="flex items-center gap-3 bg-gradient-to-r from-orange-50 to-amber-50 p-3 sm:p-4 rounded-xl border-2 border-orange-200 hover:border-orange-400 transition-all duration-200 focus-within:border-orange-500 focus-within:shadow-lg">
            <div className="bg-orange-600 text-white p-2 rounded-lg">
              <FaCalendarAlt className="text-base sm:text-lg" />
            </div>
            <input
              type="date"
              name="paperDate"
              value={form.paperDate}
              onChange={onChange}
              className="w-full bg-transparent outline-none text-sm sm:text-base font-medium"
            />
          </div>
        </div>

        <div className="group">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t("paperTime")}
          </label>
          <div className="flex items-center gap-3 bg-gradient-to-r from-red-50 to-pink-50 p-3 sm:p-4 rounded-xl border-2 border-red-200 hover:border-red-400 transition-all duration-200 focus-within:border-red-500 focus-within:shadow-lg">
            <div className="bg-red-600 text-white p-2 rounded-lg">
              <FaClock className="text-base sm:text-lg" />
            </div>
            <input
              type="time"
              name="paperTime"
              value={form.paperTime}
              onChange={onChange}
              className="w-full bg-transparent outline-none text-sm sm:text-base font-medium"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="group">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t("notes")}
        </label>
        <div className="flex items-start gap-3 sm:gap-4 bg-gradient-to-r from-yellow-50 to-amber-50 p-3 sm:p-4 rounded-xl border-2 border-yellow-200 hover:border-yellow-400 transition-all duration-200 focus-within:border-yellow-500 focus-within:shadow-lg">
          <div className="bg-yellow-600 text-white p-2 rounded-lg mt-1">
            <FaStickyNote className="text-base sm:text-lg" />
          </div>
          <textarea
            name="notes"
            rows={3}
            value={form.notes}
            onChange={onChange}
            placeholder={t("notesPlaceholder")}
            className="w-full bg-transparent outline-none text-sm sm:text-base resize-none placeholder-gray-400 font-medium"
          />
        </div>
      </div>
    </div>
  );
};

export default PaperFormFields;