import React from 'react';

export default function StatusBadge({ status, className = "" }) {
  if (!status) return null;

  const normalized = status.toUpperCase().replace(/\s+/g, '_');

  switch (normalized) {
    case 'CREATED':
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-badge text-badge bg-[#F1F5F9] text-[#475569] border border-border ${className}`}>
          Created
        </span>
      );
    case 'COLLECTED':
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-badge text-badge bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE] ${className}`}>
          Collected
        </span>
      );
    case 'IN_TRANSIT':
    case 'TRANSIT':
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-badge text-badge bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] ${className}`}>
          In Transit
        </span>
      );
    case 'AT_RTS':
    case 'RTS':
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-badge text-badge bg-[#EDE9FE] text-[#6D28D9] border border-[#E9D5FF] ${className}`}>
          At RTS
        </span>
      );
    case 'COMPLETED':
    case 'PROCESSED':
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-badge text-badge bg-[#DCFCE7] text-[#15803D] border border-[#A7F3D0] ${className}`}>
          Completed
        </span>
      );
    case 'SUPERSEDED':
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-badge text-badge bg-[#F1F5F9] text-[#64748B] line-through border border-border ${className}`}>
          Superseded
        </span>
      );
    case 'DELETED':
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-badge text-badge bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA] ${className}`}>
          Deleted
        </span>
      );
    case 'ACTIVE':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-badge text-badge bg-[#DCFCE7] text-[#15803D] border border-[#A7F3D0] ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]"></span>
          Active
        </span>
      );
    case 'DEACTIVATED':
    case 'INACTIVE':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-badge text-badge bg-[#F1F5F9] text-[#64748B] border border-border ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]"></span>
          Deactivated
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-badge text-badge bg-[#F1F5F9] text-[#475569] border border-border ${className}`}>
          {status}
        </span>
      );
  }
}

