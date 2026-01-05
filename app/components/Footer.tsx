"use client";

interface Founder {
  name: string;
  role: string;
  image: string;
}

export function Footer() {
  const founders: Founder[] = [
    {
      name: "Founder Le Quoc Trung",
      role: "Founder",
      image: "trung.jpg", // Thêm link ảnh của bạn vào đây
    },
    {
      name: "Co-Founder Nguyen Dang Khoa",
      role: "Co-Founder",
      image: "khoa.jpg", // Thêm link ảnh của bạn vào đây
    },
  ];

  return (
    <footer className="bg-gradient-to-r from-blue-500 to-green-500 text-white mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          {founders.map((founder, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center"
            >
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg mb-4 bg-white">
                <img
                  src={founder.image}
                  alt={founder.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Crect fill='%23ddd' width='128' height='128'/%3E%3Ctext fill='%23999' font-family='sans-serif' font-size='14' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EImage%3C/text%3E%3C/svg%3E";
                  }}
                />
              </div>
              <h3 className="text-xl font-bold mb-1">{founder.name}</h3>
              <p className="text-blue-100 font-medium">{founder.role}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center text-blue-100">
          <p className="text-sm">
            © {new Date().getFullYear()} AirWeather. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

