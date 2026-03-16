// Error codes
export const ERROR_CODES = {
  // Leave errors
  LV_001: { code: 'LV_001', status: 400, message: '연차가 부족합니다' },
  LV_002: { code: 'LV_002', status: 400, message: '해당 날짜는 주말/공휴일입니다' },
  LV_003: { code: 'LV_003', status: 409, message: '이미 신청이 있습니다' },
  LV_004: { code: 'LV_004', status: 400, message: '과거 날짜는 신청 불가' },
  LV_005: { code: 'LV_005', status: 400, message: '신청할 수 없는 상태' },
  // Approval errors
  AP_001: { code: 'AP_001', status: 400, message: '이미 처리된 건입니다' },
  AP_002: { code: 'AP_002', status: 403, message: '승인 권한이 없습니다' },
  // System errors
  SYS_001: { code: 'SYS_001', status: 503, message: '잠시 후 재시도해주세요' },
  SYS_002: { code: 'SYS_002', status: 503, message: '시스템 점검 중' },
  // Auth errors
  AUTH_001: { code: 'AUTH_001', status: 401, message: '로그인이 필요합니다' },
  AUTH_002: { code: 'AUTH_002', status: 403, message: '접근 권한이 없습니다' },
} as const;

// HTTP status mapping by error code
export const ERROR_HTTP_STATUS: Record<string, number> = {
  LV_001: 400,
  LV_002: 400,
  LV_003: 409,
  LV_004: 400,
  LV_005: 400,
  AP_001: 400,
  AP_002: 403,
  SYS_001: 503,
  SYS_002: 503,
  AUTH_001: 401,
  AUTH_002: 403,
};

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(errorCode: ErrorCode, details?: Array<{ field: string; message: string }>) {
    const errorDef = ERROR_CODES[errorCode];
    super(errorDef.message);
    this.code = errorDef.code;
    this.statusCode = errorDef.status;
    this.details = details;
    this.name = 'AppError';
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }

  toResponse(): { error: { code: string; message: string; details?: Array<{ field: string; message: string }> } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}
