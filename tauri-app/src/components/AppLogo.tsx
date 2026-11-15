import React from "react";

interface AppLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  useOriginalColor?: boolean;
}

export const AppLogo = React.memo(
  ({ className = "h-5 w-5", useOriginalColor = false, ...props }: AppLogoProps) => {
    return (
      <svg
        viewBox="0 0 720 720"
        fill={useOriginalColor ? "#3A8D46" : "currentColor"}
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        {...props}
      >
        <path d="M648 108C647.997 102.676 646.813 97.4188 644.533 92.6075C642.253 87.7961 638.935 83.5503 634.817 80.1759C630.699 76.8015 625.883 74.3825 620.718 73.0932C615.552 71.8039 610.165 71.6765 604.944 72.72L244.944 144.72C236.786 146.351 229.445 150.756 224.168 157.188C218.891 163.62 216.005 171.681 216 180V508.104C204.198 505.354 192.118 503.977 180 504C120.348 504 72 536.22 72 576C72 615.78 120.348 648 180 648C239.652 648 288 615.78 288 576V281.52L576 223.92V436.104C564.198 433.354 552.118 431.977 540 432C480.348 432 432 464.22 432 504C432 543.78 480.348 576 540 576C599.652 576 648 543.78 648 504V108Z" />
      </svg>
    );
  },
);

AppLogo.displayName = "AppLogo";
