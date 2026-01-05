# Setup Instructions

## Supabase Configuration

1. Tạo file `.env.local` trong thư mục gốc của project với nội dung sau:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

2. Lấy Supabase credentials:
   - Đăng nhập vào [Supabase Dashboard](https://app.supabase.com)
   - Tạo project mới hoặc chọn project hiện có
   - Vào Settings > API
   - Copy `Project URL` và `anon/public` key
   - Paste vào file `.env.local`

3. Chạy ứng dụng:
```bash
npm run dev
```

## Authentication Flow

- `/signin` - Trang đăng nhập
- `/signup` - Trang đăng ký
- `/` - Trang chính (yêu cầu đăng nhập)

## Password Requirements

Khi đăng ký, mật khẩu phải đáp ứng:
- Ít nhất 8 ký tự
- Ít nhất 1 chữ hoa
- Ít nhất 1 chữ thường
- Ít nhất 1 số
- Ít nhất 1 ký tự đặc biệt

