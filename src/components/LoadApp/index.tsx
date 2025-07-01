import { ReactElement } from "react";
import './style.css';

export default function LoadApp(props: { neverShowBanner?: boolean, children: ReactElement }): ReactElement {


  return <div>
    {props.children}
  </div>
}

