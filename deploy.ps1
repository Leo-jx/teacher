$env:Path = "C:\Program Files\nodejs;C:\Users\特莉波卡\AppData\Roaming\npm;" + $env:Path

function wrangler {
    param(
        [string[]]$args
    )
    & "C:\Program Files\nodejs\node.exe" "C:\Users\特莉波卡\AppData\Roaming\npm\node_modules\wrangler\bin\wrangler.js" $args
}

Export-ModuleMember -Function wrangler