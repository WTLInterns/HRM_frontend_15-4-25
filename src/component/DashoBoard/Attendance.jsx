import React, { useState, useEffect } from "react";
import "./animations.css";
import { FaCheckCircle, FaTimes, FaCalendarAlt } from "react-icons/fa";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./calendar-custom.css";
import axios from "axios";
import { toast } from "react-hot-toast";

export default function Attendance() {
  // Component States
  const [employeeName, setEmployeeName] = useState("");
  const [selectedDates, setSelectedDates] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [error, setError] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [submitting, setSubmitting] = useState(false);

  // Attendance statuses
  const statusOptions = [
    "Present",
    "Absent",
    "Half-Day",
    "Paid Leave",
    "Week Off",
    "Holiday"
  ];

  // When the user selects dates via the calendar,
  // add new attendance records for dates not already selected.
  // New records are created without an id.
  useEffect(() => {
    const existingDates = attendanceRecords.map(record => record.date);
    const newDates = selectedDates.filter(date => !existingDates.includes(date));
    if (newDates.length > 0) {
      const newRecords = newDates.map(date => ({
        date,
        status: "Present", // Default status.
        employeeName: employeeName || ""
      }));
      setAttendanceRecords(prev => [...prev, ...newRecords]);
    }
  }, [selectedDates, employeeName, attendanceRecords]);

  // Format a date from yyyy-mm-dd to dd-mm-yyyy.
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Check existing attendance for a specific date and employee
  const checkExistingAttendance = async (fullName, date) => {
    try {
      console.log(`Checking attendance for ${fullName} on ${date}`);
      const response = await axios.get(`http://localhost:8282/api/employee/bulk/${encodeURIComponent(fullName)}/${date}`);
      console.log('Existing attendance response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error checking attendance:', error);
      return [];
    }
  };

  // Convert local date string to API format (YYYY-MM-DD)
  const formatDateForApi = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Open the status dropdown when a calendar cell is clicked.
  const handleTileClick = ({ date, view }, event) => {
    if (view === "month") {
      const clickedDate = new Date(date);
      clickedDate.setHours(12, 0, 0, 0);
      const dateStr = clickedDate.toISOString().split("T")[0];
      // Calculate dropdown position relative to the calendar.
      const rect = event.currentTarget.getBoundingClientRect();
      const calendarRect = event.currentTarget.closest(".react-calendar").getBoundingClientRect();
      setDropdownPosition({
        x: rect.left - calendarRect.left + rect.width / 2,
        y: rect.top - calendarRect.top + rect.height / 2
      });
      setSelectedDate(dateStr);
      setShowStatusDropdown(true);
    }
  };

  // Close the dropdown.
  const handleCloseDropdown = () => {
    setShowStatusDropdown(false);
  };

  // Handle status selection.
  const handleStatusSelect = async (status) => {
    if (!employeeName || employeeName.trim() === '') {
      toast.error('Please enter employee name first');
      setShowStatusDropdown(false);
      return;
    }
    
    // Get the clicked date and convert to API format
    const clickedDate = new Date(selectedDate);
    clickedDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
    const apiFormattedDate = formatDateForApi(clickedDate);
    const formattedDateForDisplay = formatDate(clickedDate);
    
    try {
      // Get subadmin ID from localStorage
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      const subAdminId = storedUser?.subAdminId || storedUser?.id || 2;
      console.log('User data:', storedUser);
      console.log('Using subAdmin ID:', subAdminId);
      
      const encodedEmployeeName = encodeURIComponent(employeeName);
      console.log(`Employee: ${employeeName}, Encoded: ${encodedEmployeeName}`);
      console.log(`Date: ${apiFormattedDate}`);
      
      // First check if attendance exists for this date
      const existingAttendance = await checkExistingAttendance(employeeName, apiFormattedDate);
      
      // Prepare payload
      const attendancePayload = [{
        date: apiFormattedDate,
        status: status,
        employeeName: employeeName
      }];
      
      console.log('Initial payload:', attendancePayload);
      
      let response;
      let existingStatus = '';
      let updateUrl = `http://localhost:8282/api/employee/${subAdminId}/${encodedEmployeeName}/attendance/update/bulk`;
      let addUrl = `http://localhost:8282/api/employee/${subAdminId}/${encodedEmployeeName}/attendance/add/bulk`;
      
      if (existingAttendance && existingAttendance.length > 0) {
        // Attendance exists, use PUT to update
        console.log('Found existing attendance:', existingAttendance);
        existingStatus = existingAttendance[0].status;
        
        // Include the id from existing attendance
        attendancePayload[0].id = existingAttendance[0].id;
        
        console.log('PUT URL:', updateUrl);
        console.log('PUT payload:', JSON.stringify(attendancePayload));
        
        response = await axios.put(
          updateUrl,
          attendancePayload,
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );
        
        console.log('PUT response:', response);
        
        if (existingStatus === status) {
          // Use toast without .info since it might not be available
          toast(`Attendance for ${formattedDateForDisplay} is already marked as "${status}"`);
        } else {
          toast.success(`Updated attendance for ${formattedDateForDisplay} from "${existingStatus}" to "${status}"`);
        }
        
        // Update the local state with the updated record
        const recordToUpdate = attendanceRecords.find(record => {
          const recordDate = new Date(record.date);
          recordDate.setHours(12, 0, 0, 0);
          const clicked = new Date(selectedDate);
          clicked.setHours(12, 0, 0, 0);
          return recordDate.getTime() === clicked.getTime();
        });
        
        if (recordToUpdate) {
          console.log('Found record to update in state:', recordToUpdate);
          setAttendanceRecords(prev => 
            prev.map(record => {
              const recordDate = new Date(record.date);
              recordDate.setHours(12, 0, 0, 0);
              const clicked = new Date(selectedDate);
              clicked.setHours(12, 0, 0, 0);
              
              if (recordDate.getTime() === clicked.getTime()) {
                console.log('Updating record state:', { ...record, status });
                return { ...record, status };
              }
              return record;
            })
          );
        } else {
          // If not found in state, add it
          console.log('Adding updated record to state');
          setSelectedDates(prev => {
            if (prev.find(d => {
              const prevDate = new Date(d);
              prevDate.setHours(12, 0, 0, 0);
              const clicked = new Date(selectedDate);
              clicked.setHours(12, 0, 0, 0);
              return prevDate.getTime() === clicked.getTime();
            })) {
              return prev;
            }
            return [...prev, selectedDate];
          });
          
          setAttendanceRecords(prev => [
            ...prev,
            {
              date: selectedDate,
              status,
              employeeName,
              id: existingAttendance[0].id
            }
          ]);
        }
      } else {
        // No attendance record exists, use POST to create
        console.log('No existing attendance found, creating with POST');
        console.log('POST URL:', addUrl);
        console.log('POST payload:', JSON.stringify(attendancePayload));
        
        response = await axios.post(
          addUrl,
          attendancePayload,
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );
        
        console.log('POST response:', response);
        
        toast.success(`Marked new attendance as "${status}" for ${formattedDateForDisplay}`);
        
        // Add the new record to state
        if (response.data && response.data.length > 0) {
          const newRecord = response.data[0];
          console.log('Adding new record to state:', newRecord);
          
          setSelectedDates(prev => {
            if (prev.find(d => {
              const prevDate = new Date(d);
              prevDate.setHours(12, 0, 0, 0);
              const clicked = new Date(selectedDate);
              clicked.setHours(12, 0, 0, 0);
              return prevDate.getTime() === clicked.getTime();
            })) {
              return prev;
            }
            return [...prev, selectedDate];
          });
          
          setAttendanceRecords(prev => [
            ...prev,
            {
              date: selectedDate,
              status,
              employeeName,
              id: newRecord.id
            }
          ]);
        }
      }
    } catch (error) {
      console.error('Error managing attendance:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Status:', error.response.status);
        console.error('Headers:', error.response.headers);
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error details:', error.message);
      }
      
      const errorMessage = error.response?.data || error.message;
      toast.error(`Failed to manage attendance: ${errorMessage}`);
    }
    
    setShowStatusDropdown(false);
  };

  // Remove a selected date.
  const handleRemoveDate = (dateToRemove) => {
    setSelectedDates(prev => prev.filter(date => date !== dateToRemove));
    setAttendanceRecords(prev => prev.filter(record => record.date !== dateToRemove));
  };

  // Clear all selected dates.
  const handleCancelAll = () => {
    setSelectedDates([]);
    setAttendanceRecords([]);
  };

  // Validate that employeeName and at least one date are provided.
  const validateForm = () => {
    if (!employeeName || employeeName.trim() === "") {
      setError("Please enter employee name");
      return false;
    }
    if (selectedDates.length === 0) {
      setError("Please select at least one date");
      return false;
    }
    return true;
  };

  // On form submission, split the attendanceRecords into new and update records.
  // Remove any accidental id from new records, then send them to the backend.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      setError(null);

      // Make sure each record is up-to-date with employeeName.
      const updatedRecords = attendanceRecords.map(record => ({
        ...record,
        employeeName: employeeName
      }));

      // Retrieve user details.
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const subAdminId = storedUser?.subAdminId || 2;
      const encodedEmployeeName = encodeURIComponent(employeeName);

      const config = {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        }
        // NOTE: withCredentials removed to avoid CORS conflict.
      };

      // Separate records into new (without id) and updated (with id) records.
      let newRecords = updatedRecords.filter(record => record.id === undefined);
      const updateRecords = updatedRecords.filter(record => record.id !== undefined);

      // Ensure newRecords do not have an id.
      newRecords = newRecords.map(({ id, ...rest }) => rest);

      console.log("Payload for add bulk:", newRecords);
      console.log("Payload for update bulk:", updateRecords);

      const promises = [];
      // Use full backend URL.
      if (newRecords.length > 0) {
        promises.push(
          axios
            .post(
              `http://localhost:8282/api/employee/${subAdminId}/${encodedEmployeeName}/attendance/add/bulk`,
              newRecords,
              config
            )
            .then(response => ({
              type: "add",
              records: newRecords,
              response: response.data
            }))
        );
      }
      if (updateRecords.length > 0) {
        promises.push(
          axios
            .post(
              `http://localhost:8282/api/employee/${subAdminId}/${encodedEmployeeName}/attendance/update/bulk`,
              updateRecords,
              config
            )
            .then(response => ({
              type: "update",
              records: updateRecords,
              response: response.data
            }))
        );
      }

      const results = await Promise.allSettled(promises);
      results.forEach(result => {
        if (result.status === "fulfilled") {
          const { type, records } = result.value;
          if (type === "add") {
            records.forEach(rec => {
              toast.success(`Added attendance for ${formatDate(rec.date)}: ${rec.status}`);
            });
          } else if (type === "update") {
            records.forEach(rec => {
              toast.success(`Updated attendance for ${formatDate(rec.date)}: ${rec.status}`);
            });
          }
        } else {
          toast.error(`Error processing bulk attendance: ${result.reason}`);
        }
      });

      setShowSuccessModal(true);
      localStorage.setItem("submittedDatesCount", selectedDates.length.toString());
      setEmployeeName("");
      setSelectedDates([]);
      setAttendanceRecords([]);
      setSubmitting(false);
    } catch (err) {
      setSubmitting(false);
      console.error("Error marking attendance:", err);
      if (err.response) {
        if (err.response.status === 403) {
          setError("Access denied. Please check your login credentials or permissions.");
        } else if (err.response.status === 401) {
          setError("Unauthorized. Please log in again.");
        } else {
          setError(err.response.data || `Server error: ${err.response.status}`);
        }
      } else if (err.request) {
        setError("Network error: Cannot connect to the server. Is the backend running?");
      } else {
        setError(`Error: ${err.message}`);
      }
    }
  };

  // Define CSS classes for status coloring.
  const statusColors = {
    Present: "bg-green-900/30 border-green-700",
    Absent: "bg-red-900/30 border-red-700",
    "Half-Day": "bg-yellow-900/30 border-yellow-700",
    "Paid Leave": "bg-purple-900/30 border-purple-700",
    "Week Off": "bg-blue-900/30 border-blue-700",
    Holiday: "bg-pink-900/30 border-pink-700"
  };

  // Render attendance status on each calendar tile.
  const tileContent = ({ date, view }) => {
    if (view === "month") {
      const tileDate = new Date(date);
      tileDate.setHours(12, 0, 0, 0);
      const dateStr = tileDate.toISOString().split("T")[0];
      const record = attendanceRecords.find(r => r.date === dateStr);
      if (record) {
        return (
          <div className={`w-full h-full p-1 ${statusColors[record.status]}`}>
            <div className="text-xs font-bold">{record.status}</div>
          </div>
        );
      }
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 animate-fadeIn">
      {error && (
        <div className="bg-red-500 text-white p-3 mb-4 rounded animate-shake">
          {error}
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowSuccessModal(false)}
          ></div>
          <div className="bg-slate-800 rounded-lg shadow-xl border border-green-800 w-full max-w-md p-6 z-10 animate-scaleIn">
            <div className="flex items-center mb-4 text-green-500">
              <FaCheckCircle className="text-2xl mr-3 animate-pulse" />
              <h3 className="text-xl font-semibold">Attendance Marked Successfully</h3>
            </div>
            <div className="mb-6">
              <p className="text-gray-200">
                Attendance has been marked for {localStorage.getItem("submittedDatesCount") || 0} day(s)
              </p>
            </div>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-all duration-300"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Attendance Marking Form */}
      <div className="w-full bg-slate-800 shadow-lg rounded-lg mb-8 border border-blue-900 animate-slideIn">
        <div className="p-6">
          <h2 className="text-2xl font-semibold mb-6 text-gray-100">Mark Attendance</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Employee Name */}
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Employee Name
              </label>
              <input
                type="text"
                className="w-full p-2 border border-gray-700 rounded-lg bg-slate-700 text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={employeeName}
                onChange={e => setEmployeeName(e.target.value)}
                required
              />
            </div>

            {/* Calendar */}
            <div className="relative">
              <Calendar
                onClickDay={(value, event) => handleTileClick({ date: value, view: "month" }, event)}
                value={null}
                tileContent={tileContent}
                className="bg-slate-800 text-gray-100 border-gray-700 rounded-lg w-full"
                showNeighboringMonth={false}
              />

              {/* Status Dropdown */}
              {showStatusDropdown && (
                <div
                  className="absolute z-50 bg-slate-700 rounded-lg shadow-xl border border-gray-600"
                  style={{
                    top: `${dropdownPosition.y}px`,
                    left: `${dropdownPosition.x}px`,
                    transform: "translate(-50%, -50%)",
                    width: "180px"
                  }}
                >
                  <div className="p-2 border-b border-gray-600 text-center font-medium text-gray-300">
                    {formatDate(selectedDate)}
                  </div>
                  {statusOptions.map(status => (
                    <button
                      key={status}
                      type="button"
                      className={`block w-full text-left px-4 py-2 hover:bg-slate-600 text-gray-100 ${
                        attendanceRecords.find(r => r.date === selectedDate)?.status === status
                          ? "bg-blue-600"
                          : ""
                      }`}
                      onClick={() => handleStatusSelect(status)}
                    >
                      {status}
                    </button>
                  ))}
                  <div className="p-2 border-t border-gray-600">
                    <button
                      type="button"
                      onClick={handleCloseDropdown}
                      className="w-full py-1 bg-gray-600 text-white rounded hover:bg-gray-500 transition flex items-center justify-center gap-1"
                    >
                      <FaTimes className="text-xs" /> Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Selected Dates Summary */}
            {selectedDates.length > 0 && (
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-200 mb-2">
                  Selected Dates
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedDates.map(date => {
                    const record = attendanceRecords.find(r => r.date === date);
                    return (
                      <div
                        key={date}
                        className={`px-3 py-1 rounded-full flex items-center gap-2 ${statusColors[record?.status]}`}
                      >
                        <span>{formatDate(date)}</span>
                        <span className="font-medium">{record?.status}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDate(date)}
                          className="text-gray-400 hover:text-red-400"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Submit and Cancel Buttons */}
            {selectedDates.length > 0 && (
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 text-lg"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FaCheckCircle /> Submit Attendance
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancelAll}
                  className="flex-1 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center justify-center gap-2 text-lg"
                >
                  <FaTimes /> Cancel All
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
